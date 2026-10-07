-- =====================================================================
-- Spacers Bénévoles — 2026-10-07 — Remplaçants : billets d'invitation par e-mail
--   - billet_envoye : le pilote/billetterie coche quand le billet Tickie est parti
--   - Récap automatique à J-2 9h (liste des billets à émettre) + rappel J-1 9h
--   - Bouton pilote "M'envoyer la liste maintenant"
--   - E-mail d'invitation au bénévole : "ton billet arrive par e-mail au plus tard la veille"
-- Idempotent. Affectations par := uniquement (compatibilité éditeur Supabase).
-- Pré-requis : 2026-10-07-remplacants.sql déjà passé.
-- =====================================================================

alter table public.inscriptions add column if not exists billet_envoye boolean not null default false;
alter table public.inscriptions add column if not exists billet_envoye_le timestamptz;

-- Destinataire(s) du récap billetterie (modifiable sans toucher au code)
create table if not exists public.parametres_app (
  cle text primary key,
  valeur text not null
);
alter table public.parametres_app enable row level security;
drop policy if exists parametres_app_pilote on public.parametres_app;
create policy parametres_app_pilote on public.parametres_app
  for all to authenticated using (public.is_admin_or_pilote()) with check (public.is_admin_or_pilote());
insert into public.parametres_app (cle, valeur)
values ('email_billetterie_invitations', 'c.augustin@spacerstoulouse.fr')
on conflict (cle) do nothing;

-- ---------------------------------------------------------------------
-- E-mails automatiques (texte d'invitation mis à jour)
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
          ||'<p><strong>Le club t''offre ta place en tribune.</strong> Ton billet t''arrivera par e-mail de la billetterie au plus tard la veille du match (pense à vérifier tes spams).</p>'
          ||'<p>Et si un bénévole a un empêchement de dernière minute, tu seras le premier sur place pour entrer en jeu. Indique dans l''app que tu viens (« Je viens en tribune »).</p>'
          ||v_btn||'<p style="color:#5A7291;font-size:13px;">À très vite en tribune ! — L''équipe des pilotes Spacers</p></div>',
          'Le club t''offre ta place en tribune pour Spacers vs '||coalesce(v_m.adversaire,'')||' du '||v_date||v_heure||'. Ton billet t''arrivera par e-mail au plus tard la veille du match.',
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


-- ---------------------------------------------------------------------
-- Vues bénévole / pilote : ajout de billet_envoye (type de retour modifié)
-- ---------------------------------------------------------------------
drop function if exists public.mon_statut_remplacant(uuid);
create function public.mon_statut_remplacant(p_match_id uuid)
returns table (position_attente int, nb_remplacants int, nb_dispos int, plafond int,
               invitation_tribune boolean, sur_place boolean, prioritaire boolean, billet_envoye boolean)
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
      public.a_priorite_remplacant(v_uid, p_match_id),
      (select i.billet_envoye from public.inscriptions i where i.match_id = p_match_id and i.benevole_id = v_uid);
end; $$;
revoke all on function public.mon_statut_remplacant(uuid) from public, anon;
grant execute on function public.mon_statut_remplacant(uuid) to authenticated;

drop function if exists public.remplacants_du_match(uuid);
create function public.remplacants_du_match(p_match_id uuid)
returns table (inscription_id uuid, benevole_id uuid, prenom text, nom text, matchs_joues int,
               depuis timestamptz, invitation_tribune boolean, sur_place boolean, prioritaire boolean,
               billet_envoye boolean, email text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_admin_or_pilote() then raise exception 'Réservé aux pilotes'; end if;
  return query
    select i.id, i.benevole_id, b.prenom::text, b.nom::text, b.matchs_joues,
           coalesce(i.liste_attente_le, i.created_at), i.invitation_tribune, i.sur_place,
           public.a_priorite_remplacant(i.benevole_id, i.match_id),
           i.billet_envoye, b.email::text
    from public.inscriptions i
    join public.benevoles b on b.id = i.benevole_id
    where i.match_id = p_match_id and i.statut = 'liste_attente'
    order by public.a_priorite_remplacant(i.benevole_id, i.match_id) desc,
             coalesce(i.liste_attente_le, i.created_at);
end; $$;
revoke all on function public.remplacants_du_match(uuid) from public, anon;
grant execute on function public.remplacants_du_match(uuid) to authenticated;

-- horodatage automatique du billet
create or replace function public.tg_billet_envoye_le()
returns trigger language plpgsql as $$
begin
  if new.billet_envoye and not coalesce(old.billet_envoye, false) then new.billet_envoye_le := now(); end if;
  if not new.billet_envoye then new.billet_envoye_le := null; end if;
  return new;
end; $$;
drop trigger if exists trg_billet_envoye_le on public.inscriptions;
create trigger trg_billet_envoye_le before update of billet_envoye on public.inscriptions
  for each row execute function public.tg_billet_envoye_le();

-- ---------------------------------------------------------------------
-- Récap billetterie : liste des billets d'invitation à émettre
--   p_match_id NULL  -> mode automatique (cron) : J-2 = récap, J-1 = rappel
--   p_match_id donné -> envoi immédiat pour ce match (bouton pilote)
-- ---------------------------------------------------------------------
create or replace function public.recap_invitations_remplacants(p_match_id uuid default null)
returns int language plpgsql security definer set search_path to 'public' as $$
declare
  v_dest text; v_m record; r record; v_rows text; v_txt text; v_nb int; v_total int := 0;
  v_rappel boolean; v_date text; v_heure text;
begin
  if p_match_id is not null and auth.uid() is not null and not public.is_admin_or_pilote() then
    raise exception 'Réservé aux pilotes';
  end if;
  v_dest := coalesce((select p.valeur from public.parametres_app p where p.cle = 'email_billetterie_invitations'), 'c.augustin@spacerstoulouse.fr');

  for v_m in
    select m.id, m.adversaire, m.date_match, m.heure from public.matchs m
    where (p_match_id is not null and m.id = p_match_id)
       or (p_match_id is null and m.date_match in (current_date + 1, current_date + 2))
  loop
    v_rappel := (p_match_id is null and v_m.date_match = current_date + 1);
    v_rows := ''; v_txt := ''; v_nb := 0;
    for r in
      select b.prenom, b.nom, b.email
      from public.inscriptions i join public.benevoles b on b.id = i.benevole_id
      where i.match_id = v_m.id and i.statut = 'liste_attente'
        and i.invitation_tribune and not i.billet_envoye
      order by b.nom, b.prenom
    loop
      v_nb := v_nb + 1;
      v_rows := v_rows || '<tr><td style="padding:6px 10px;border-bottom:1px solid #E6ECF3;">'||coalesce(r.prenom,'')||'</td>'
             || '<td style="padding:6px 10px;border-bottom:1px solid #E6ECF3;">'||coalesce(r.nom,'')||'</td>'
             || '<td style="padding:6px 10px;border-bottom:1px solid #E6ECF3;">'||coalesce(r.email,'')||'</td></tr>';
      v_txt := v_txt || coalesce(r.prenom,'')||';'||coalesce(r.nom,'')||';'||coalesce(r.email,'')||E'\n';
    end loop;

    if v_nb > 0 then
      v_date  := to_char(v_m.date_match::date, 'DD/MM/YYYY');
      v_heure := coalesce(' à ' || to_char(v_m.heure, 'HH24"h"MI'), '');
      insert into public.email_outbox (to_email, to_name, subject, body_html, body_text, template_key, metadata, match_id, type_email)
      values (v_dest, 'Billetterie',
        (case when v_rappel then '⏰ Rappel J-1 : ' else '🎟️ ' end) || v_nb || ' billet(s) d''invitation remplaçants à envoyer — Spacers vs ' || coalesce(v_m.adversaire,'') || ' (' || v_date || ')',
        '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1a1a18;">'
        ||'<h2 style="color:#042C53;">'||(case when v_rappel then 'Rappel : billets remplaçants pas encore envoyés' else 'Billets d''invitation remplaçants à émettre' end)||'</h2>'
        ||'<p>Match : <strong>Spacers vs '||coalesce(v_m.adversaire,'')||'</strong> du '||v_date||v_heure||'.</p>'
        ||'<p><strong>'||v_nb||' remplaçant(s)</strong> ont reçu une invitation en tribune. Émets un billet d''invitation dans Tickie pour chacun et envoie-le à l''adresse ci-dessous'
        ||(case when v_rappel then ' <strong>aujourd''hui</strong> (le match est demain).' else ', au plus tard la veille du match.' end)||'</p>'
        ||'<table style="border-collapse:collapse;width:100%;font-size:14px;"><tr style="background:#042C53;color:white;"><th style="padding:6px 10px;text-align:left;">Prénom</th><th style="padding:6px 10px;text-align:left;">Nom</th><th style="padding:6px 10px;text-align:left;">E-mail</th></tr>'
        ||v_rows||'</table>'
        ||'<p style="margin-top:16px;">Une fois les billets partis, coche <strong>« 📨 Billet envoyé »</strong> pour chacun dans l''espace pilote (écran Match → Effectif &amp; remplaçants) : le bénévole voit alors que son billet est parti, et le rappel ne repart pas.</p>'
        ||'<p style="margin-top:20px;"><a href="https://benevoles.spacerstoulouse.fr" style="background:#185FA5;color:white;border-radius:50px;padding:12px 20px;text-decoration:none;font-weight:700;">Ouvrir l''espace pilote</a></p></div>',
        'Billets invitation remplacants a emettre - Spacers vs '||coalesce(v_m.adversaire,'')||' du '||v_date||E'\nPrenom;Nom;Email\n'||v_txt,
        'remplacant_recap_billetterie', jsonb_build_object('match_id', v_m.id, 'rappel', v_rappel, 'nb', v_nb),
        v_m.id, 'remplacant_recap_billetterie');
      v_total := v_total + v_nb;
    end if;
  end loop;
  return v_total;
end; $$;
revoke all on function public.recap_invitations_remplacants(uuid) from public, anon;
grant execute on function public.recap_invitations_remplacants(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Planification : tous les jours à 9h (Paris, 7h UTC en heure d'été / 8h l'hiver)
-- ---------------------------------------------------------------------
do $$
begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'remplacants-recap-billetterie';
  perform cron.schedule('remplacants-recap-billetterie', '0 7 * * *', 'select public.recap_invitations_remplacants()');
end $$;

-- Contrôle
select jobname, schedule, command from cron.job where jobname = 'remplacants-recap-billetterie';
