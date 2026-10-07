-- =====================================================================
-- Spacers Bénévoles — 2026-10-07 — Dispositif "Remplaçants"
--   (statut technique 'liste_attente', affiché "Remplaçant" dans l'app)
--   1. Invitation tribune + "je viens en tribune" (remplaçant sur place)
--   2. Position du remplaçant (RPC mon_statut_remplacant)
--   3. Priorité au match suivant pour un remplaçant non appelé
--   4. Points + badge "12e homme" après le match
--   5. E-mails : place libérée (bénévole), invitation (bénévole),
--      désistement avec remplaçants en attente (pilotes)
-- Idempotent. Affectations par := uniquement (compatibilité éditeur Supabase).
-- Pré-requis : 2026-10-07-plafond-match-postes-coequipiers.sql déjà passé.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Colonnes + table de suivi des remerciements
-- ---------------------------------------------------------------------
alter table public.inscriptions add column if not exists invitation_tribune boolean not null default false;
alter table public.inscriptions add column if not exists sur_place boolean not null default false;

create table if not exists public.remplacant_merci (
  benevole_id uuid not null references public.benevoles(id) on delete cascade,
  match_id    uuid not null references public.matchs(id) on delete cascade,
  credite_le  timestamptz not null default now(),
  vu          boolean not null default false,
  primary key (benevole_id, match_id)
);
alter table public.remplacant_merci enable row level security;
drop policy if exists remplacant_merci_select_self on public.remplacant_merci;
create policy remplacant_merci_select_self on public.remplacant_merci
  for select to authenticated using (benevole_id = auth.uid() or public.is_admin_or_pilote());

-- Barème + badge (valeur = 1/3 des points de présence, minimum 10)
insert into public.points_bareme (motif, libelle, points, recurrent, actif)
select 'remplacant', 'Remplaçant disponible',
       greatest(10, coalesce((select pb.points from public.points_bareme pb where pb.motif = 'presence'), 30) / 3),
       true, true
where not exists (select 1 from public.points_bareme where motif = 'remplacant');

insert into public.badges_def (code, libelle, emoji, description, points_bonus)
select 'douzieme_homme', '12e homme', '🪑', 'A répondu présent comme remplaçant : l''équipe pouvait compter sur toi.', 0
where not exists (select 1 from public.badges_def where code = 'douzieme_homme');

-- ---------------------------------------------------------------------
-- 1. Priorité : remplaçant d'un match passé, pas encore rejoué depuis
-- ---------------------------------------------------------------------
create or replace function public.a_priorite_remplacant(p_benevole uuid, p_match uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1
    from public.inscriptions w
    join public.matchs mw on mw.id = w.match_id
    where w.benevole_id = p_benevole
      and w.statut = 'liste_attente'
      and w.match_id <> p_match
      and mw.date_match < current_date
      and not exists (
        select 1 from public.inscriptions d
        join public.matchs md on md.id = d.match_id
        where d.benevole_id = p_benevole and d.statut = 'disponible'
          and d.match_id <> p_match and md.date_match > mw.date_match
      )
  );
$$;

-- Plafond v3 : un remplaçant prioritaire passe même si le match est plein
create or replace function public.tg_plafond_benevoles_match()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_max int; v_n int;
begin
  if new.statut = 'liste_attente' then
    if new.liste_attente_le is null then new.liste_attente_le := now(); end if;
    return new;
  end if;

  if new.statut is distinct from 'disponible' then return new; end if;
  if tg_op = 'UPDATE' and old.statut = 'disponible' then return new; end if;

  if tg_op = 'INSERT' and exists (
       select 1 from public.inscriptions
       where benevole_id = new.benevole_id and match_id = new.match_id) then
    return new;
  end if;

  if public.is_admin_or_pilote() then return new; end if;

  perform 1 from public.matchs where id = new.match_id for update;
  v_max := (select m.benevoles_max from public.matchs m where m.id = new.match_id);
  if v_max is null or v_max <= 0 then return new; end if;

  v_n := (select count(*) from public.inscriptions x
           where x.match_id = new.match_id and x.statut = 'disponible'
             and x.benevole_id <> new.benevole_id);

  if v_n >= v_max and not public.a_priorite_remplacant(new.benevole_id, new.match_id) then
    new.statut := 'liste_attente';
    new.liste_attente_le := coalesce(new.liste_attente_le, now());
  end if;
  return new;
end; $$;

-- ---------------------------------------------------------------------
-- 2. Statut du remplaçant (vue bénévole)
-- ---------------------------------------------------------------------
create or replace function public.mon_statut_remplacant(p_match_id uuid)
returns table (position_attente int, nb_remplacants int, nb_dispos int, plafond int,
               invitation_tribune boolean, sur_place boolean, prioritaire boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_le timestamptz;
begin
  if v_uid is null then return; end if;
  if not exists (select 1 from public.inscriptions i
                 where i.match_id = p_match_id and i.benevole_id = v_uid and i.statut = 'liste_attente') then
    return;
  end if;
  v_le := (select coalesce(i.liste_attente_le, i.created_at) from public.inscriptions i
           where i.match_id = p_match_id and i.benevole_id = v_uid);
  return query
    select
      (select count(*)::int from public.inscriptions x
        where x.match_id = p_match_id and x.statut = 'liste_attente'
          and coalesce(x.liste_attente_le, x.created_at) <= v_le),
      (select count(*)::int from public.inscriptions x
        where x.match_id = p_match_id and x.statut = 'liste_attente'),
      (select count(*)::int from public.inscriptions x
        where x.match_id = p_match_id and x.statut = 'disponible'),
      (select m.benevoles_max from public.matchs m where m.id = p_match_id),
      (select i.invitation_tribune from public.inscriptions i where i.match_id = p_match_id and i.benevole_id = v_uid),
      (select i.sur_place from public.inscriptions i where i.match_id = p_match_id and i.benevole_id = v_uid),
      public.a_priorite_remplacant(v_uid, p_match_id);
end; $$;
revoke all on function public.mon_statut_remplacant(uuid) from public, anon;
grant execute on function public.mon_statut_remplacant(uuid) to authenticated;

-- "Je viens en tribune" (remplaçant sur place)
create or replace function public.remplacant_set_sur_place(p_match_id uuid, p_val boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'non_authentifie'; end if;
  update public.inscriptions set sur_place = coalesce(p_val, false)
  where match_id = p_match_id and benevole_id = auth.uid() and statut = 'liste_attente';
end; $$;
revoke all on function public.remplacant_set_sur_place(uuid, boolean) from public, anon;
grant execute on function public.remplacant_set_sur_place(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Liste des remplaçants (vue pilote)
-- ---------------------------------------------------------------------
create or replace function public.remplacants_du_match(p_match_id uuid)
returns table (inscription_id uuid, benevole_id uuid, prenom text, nom text, matchs_joues int,
               depuis timestamptz, invitation_tribune boolean, sur_place boolean, prioritaire boolean)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_admin_or_pilote() then raise exception 'Réservé aux pilotes'; end if;
  return query
    select i.id, i.benevole_id, b.prenom::text, b.nom::text, b.matchs_joues,
           coalesce(i.liste_attente_le, i.created_at), i.invitation_tribune, i.sur_place,
           public.a_priorite_remplacant(i.benevole_id, i.match_id)
    from public.inscriptions i
    join public.benevoles b on b.id = i.benevole_id
    where i.match_id = p_match_id and i.statut = 'liste_attente'
    order by public.a_priorite_remplacant(i.benevole_id, i.match_id) desc,
             coalesce(i.liste_attente_le, i.created_at);
end; $$;
revoke all on function public.remplacants_du_match(uuid) from public, anon;
grant execute on function public.remplacants_du_match(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Remerciement + points après le match (appelé à l'ouverture de l'app)
-- ---------------------------------------------------------------------
create or replace function public.remercier_mes_remplacements()
returns table (match_id uuid, adversaire text, date_match date, points int)
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_saison text; v_pts int; r record;
begin
  if v_uid is null then return; end if;
  v_saison := (select s.code from public.saisons s where s.active limit 1);
  v_pts := coalesce((select pb.points from public.points_bareme pb where pb.motif = 'remplacant' and pb.actif), 0);

  for r in
    select i.match_id as mid
    from public.inscriptions i
    join public.matchs m on m.id = i.match_id
    where i.benevole_id = v_uid and i.statut = 'liste_attente'
      and m.date_match < current_date
      and not exists (select 1 from public.remplacant_merci rm
                      where rm.benevole_id = v_uid and rm.match_id = i.match_id)
  loop
    insert into public.remplacant_merci (benevole_id, match_id) values (v_uid, r.mid)
      on conflict do nothing;
    if v_saison is not null then
      begin
        perform public.award_points(v_uid, 'remplacant', 'match', r.mid::text, 'Remplaçant');
        perform public._grant_badge(v_uid, v_saison, 'douzieme_homme');
      exception when others then
        raise warning 'remplacant points: %', sqlerrm;
      end;
    end if;
  end loop;

  -- renvoie les remerciements pas encore affichés, puis les marque vus
  return query
    select rm.match_id, m.adversaire::text, m.date_match, v_pts
    from public.remplacant_merci rm
    join public.matchs m on m.id = rm.match_id
    where rm.benevole_id = v_uid and not rm.vu
    order by m.date_match;
  update public.remplacant_merci set vu = true where benevole_id = v_uid and not vu;
end; $$;
revoke all on function public.remercier_mes_remplacements() from public, anon;
grant execute on function public.remercier_mes_remplacements() to authenticated;

-- ---------------------------------------------------------------------
-- 5. E-mails automatiques (via email_outbox, comme les autres envois)
-- ---------------------------------------------------------------------
create or replace function public.tg_remplacants_emails()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_b record; v_m record; v_p record; v_premier record;
  v_date text; v_heure text; v_nb int;
  v_btn text := '<p style="margin-top:20px;"><a href="https://benevoles.spacerstoulouse.fr" style="background:#185FA5;color:white;border-radius:50px;padding:12px 20px;text-decoration:none;font-weight:700;">Ouvrir mon espace bénévole</a></p>';
begin
  for v_m in select id, adversaire, date_match, heure from public.matchs where id = new.match_id loop
    v_date  := to_char(v_m.date_match::date, 'DD/MM/YYYY');
    v_heure := coalesce(' à ' || to_char(v_m.heure, 'HH24"h"MI'), '');

    -- (a) Remplaçant appelé : une place s'est libérée
    if tg_op = 'UPDATE' and old.statut = 'liste_attente' and new.statut = 'disponible' then
      for v_b in select prenom, email from public.benevoles
                 where id = new.benevole_id and email is not null and email not like '%@spacers-deleted.local' loop
        insert into public.email_outbox (to_email, to_name, subject, body_html, body_text, template_key, metadata, match_id, benevole_id, type_email)
        values (v_b.email, coalesce(v_b.prenom,''),
          '🎉 Une place s''est libérée : tu entres en jeu contre ' || coalesce(v_m.adversaire,''),
          '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a18;">'
          ||'<h2 style="color:#042C53;">Tu entres en jeu ! 🏐</h2>'
          ||'<p>Bonjour '||coalesce(v_b.prenom,'')||',</p>'
          ||'<p>Une place s''est libérée dans l''équipe bénévole de <strong>Spacers vs '||coalesce(v_m.adversaire,'')||'</strong> du '||v_date||v_heure||'. Tu étais remplaçant : <strong>tu fais désormais partie de l''équipe du match</strong>.</p>'
          ||'<p>Ton poste et ton heure d''arrivée apparaîtront dans ton planning dès que le pilote les aura attribués.</p>'
          ||'<p>Un empêchement ? Signale-le vite dans l''app pour que le remplaçant suivant puisse en profiter.</p>'
          ||v_btn||'<p style="color:#5A7291;font-size:13px;">Merci d''avoir répondu présent. — L''équipe des pilotes Spacers</p></div>',
          'Une place s''est liberee pour Spacers vs '||coalesce(v_m.adversaire,'')||' du '||v_date||v_heure||'. Tu fais desormais partie de l''equipe du match. Ton poste apparaitra dans ton planning.',
          'remplacant_appele', jsonb_build_object('benevole_id', new.benevole_id, 'match_id', new.match_id),
          new.match_id, new.benevole_id, 'remplacant_appele');
      end loop;
    end if;

    -- (b) Invitation tribune accordée
    if tg_op = 'UPDATE' and new.statut = 'liste_attente'
       and new.invitation_tribune and not coalesce(old.invitation_tribune, false) then
      for v_b in select prenom, email from public.benevoles
                 where id = new.benevole_id and email is not null and email not like '%@spacers-deleted.local' loop
        insert into public.email_outbox (to_email, to_name, subject, body_html, body_text, template_key, metadata, match_id, benevole_id, type_email)
        values (v_b.email, coalesce(v_b.prenom,''),
          '🎟️ Ton invitation pour Spacers vs ' || coalesce(v_m.adversaire,''),
          '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a18;">'
          ||'<h2 style="color:#042C53;">Ta place en tribune t''attend 🎟️</h2>'
          ||'<p>Bonjour '||coalesce(v_b.prenom,'')||',</p>'
          ||'<p>L''équipe bénévole de <strong>Spacers vs '||coalesce(v_m.adversaire,'')||'</strong> du '||v_date||v_heure||' est au complet, mais tu fais partie des remplaçants et nous tenons à ce que tu vives le match avec nous.</p>'
          ||'<p><strong>Le club t''offre ta place en tribune.</strong> Ton invitation est à ton nom à l''accueil bénévoles.</p>'
          ||'<p>Et si un bénévole a un empêchement de dernière minute, tu seras le premier sur place pour entrer en jeu. Indique dans l''app que tu viens (« Je viens en tribune »).</p>'
          ||v_btn||'<p style="color:#5A7291;font-size:13px;">À samedi en tribune ! — L''équipe des pilotes Spacers</p></div>',
          'Le club t''offre ta place en tribune pour Spacers vs '||coalesce(v_m.adversaire,'')||' du '||v_date||v_heure||'. Invitation a ton nom a l''accueil benevoles.',
          'remplacant_invitation', jsonb_build_object('benevole_id', new.benevole_id, 'match_id', new.match_id),
          new.match_id, new.benevole_id, 'remplacant_invitation');
      end loop;
    end if;

    -- (c) Désistement alors que des remplaçants attendent : alerte pilotes
    if tg_op = 'UPDATE' and old.statut = 'disponible' and new.statut <> 'disponible'
       and v_m.date_match >= current_date then
      v_nb := (select count(*) from public.inscriptions x where x.match_id = new.match_id and x.statut = 'liste_attente');
      if v_nb > 0 then
        for v_premier in
          select b.prenom, b.nom from public.inscriptions x join public.benevoles b on b.id = x.benevole_id
          where x.match_id = new.match_id and x.statut = 'liste_attente'
          order by public.a_priorite_remplacant(x.benevole_id, x.match_id) desc, coalesce(x.liste_attente_le, x.created_at)
          limit 1
        loop
          for v_p in select prenom, email from public.benevoles
                     where role in ('pilote','admin') and statut_compte = 'actif'
                       and email is not null and email not like '%@spacers-deleted.local' loop
            insert into public.email_outbox (to_email, to_name, subject, body_html, body_text, template_key, metadata, match_id, type_email)
            values (v_p.email, coalesce(v_p.prenom,''),
              '🔁 Place libérée — ' || v_nb || ' remplaçant(s) en attente pour ' || coalesce(v_m.adversaire,''),
              '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a18;">'
              ||'<h2 style="color:#042C53;">Une place s''est libérée</h2>'
              ||'<p>Bonjour '||coalesce(v_p.prenom,'')||',</p>'
              ||'<p>Un bénévole s''est retiré de <strong>Spacers vs '||coalesce(v_m.adversaire,'')||'</strong> du '||v_date||v_heure||'. '
              ||'<strong>'||v_nb||' remplaçant(s)</strong> attendent. Premier de la liste : <strong>'||coalesce(v_premier.prenom,'')||' '||coalesce(v_premier.nom,'')||'</strong>.</p>'
              ||'<p>Valide-le en un clic dans l''écran Match (bloc « Remplaçants »).</p>'
              ||'<p style="margin-top:20px;"><a href="https://benevoles.spacerstoulouse.fr" style="background:#185FA5;color:white;border-radius:50px;padding:12px 20px;text-decoration:none;font-weight:700;">Ouvrir l''espace pilote</a></p></div>',
              'Place liberee pour Spacers vs '||coalesce(v_m.adversaire,'')||'. '||v_nb||' remplacant(s) en attente, premier : '||coalesce(v_premier.prenom,'')||' '||coalesce(v_premier.nom,'')||'.',
              'remplacant_place_liberee_pilote', jsonb_build_object('match_id', new.match_id),
              new.match_id, 'remplacant_place_liberee_pilote');
          end loop;
        end loop;
      end if;
    end if;
  end loop;
  return new;
exception when others then
  raise warning 'tg_remplacants_emails: %', sqlerrm;  -- un e-mail ne doit jamais bloquer une inscription
  return new;
end; $$;

drop trigger if exists trg_zz_remplacants_emails on public.inscriptions;
create trigger trg_zz_remplacants_emails
  after update of statut, invitation_tribune on public.inscriptions
  for each row execute function public.tg_remplacants_emails();

-- Contrôle
select motif, libelle, points from public.points_bareme where motif in ('presence','remplacant');
