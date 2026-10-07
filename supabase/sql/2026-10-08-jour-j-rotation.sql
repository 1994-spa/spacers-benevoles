-- =====================================================================
-- Spacers Bénévoles — 2026-10-08 — Jour J & rotation
--   A. Pointage par QR code (qr_token + RPC pointer_benevole)
--   B. Notifications push (file push_outbox -> Edge Function send-push)
--   C. Appel automatique des remplaçants + confirmation (24 h max)
--   E. Indicateurs d'équité de rotation (RPC stats_rotation)
-- Idempotent. Affectations par := uniquement (compatibilité éditeur Supabase).
-- Pré-requis : scripts 2026-10-07 (plafond, remplacants, billets) déjà passés.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. POINTAGE QR
-- ---------------------------------------------------------------------
alter table public.benevoles add column if not exists qr_token text;
update public.benevoles set qr_token = upper(replace(gen_random_uuid()::text, '-', '')) where qr_token is null;
alter table public.benevoles alter column qr_token set default upper(replace(gen_random_uuid()::text, '-', ''));
create unique index if not exists benevoles_qr_token_uniq on public.benevoles(qr_token);

alter table public.inscriptions add column if not exists pointe_le timestamptz;

-- Heure d'arrivée attendue d'un bénévole pour un match (planning détaillé > heure réglée > coup d'envoi - 3h)
create or replace function public.heure_arrivee_attendue(p_benevole uuid, p_match uuid)
returns time language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select min(mp.heure_debut::time) from public.match_planning mp
      where mp.match_id = p_match and mp.benevole_id = p_benevole),
    (select m.heure_arrivee::time from public.matchs m where m.id = p_match),
    (select (coalesce(m.heure, '20:00'::time) - interval '3 hours')::time from public.matchs m where m.id = p_match)
  );
$$;

-- Scan pilote : p_token = contenu du QR ("SPB:XXXX" ou "XXXX")
create or replace function public.pointer_benevole(p_token text, p_match_id uuid, p_faire_entrer boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_tok text; v_bid uuid; v_prenom text; v_nom text; v_insc uuid; v_statut text; v_sjm text;
  v_poste text; v_ref time; v_now time; v_new text; v_retard int;
begin
  if not public.is_admin_or_pilote() then raise exception 'Réservé aux pilotes'; end if;
  v_tok := upper(regexp_replace(coalesce(p_token,''), '^.*SPB:', '', 'i'));
  v_tok := regexp_replace(v_tok, '[^A-F0-9]', '', 'g');
  v_bid := (select b.id from public.benevoles b where b.qr_token = v_tok);
  if v_bid is null then return jsonb_build_object('ok', false, 'code', 'inconnu'); end if;
  v_prenom := (select b.prenom from public.benevoles b where b.id = v_bid);
  v_nom    := (select b.nom from public.benevoles b where b.id = v_bid);

  v_insc   := (select i.id from public.inscriptions i where i.match_id = p_match_id and i.benevole_id = v_bid);
  v_statut := (select i.statut from public.inscriptions i where i.id = v_insc);
  v_sjm    := (select i.statut_jour_match from public.inscriptions i where i.id = v_insc);
  v_poste  := (select p.nom from public.inscriptions i join public.postes p on p.id = i.poste_id where i.id = v_insc);

  if v_insc is null or v_statut not in ('disponible', 'liste_attente') then
    return jsonb_build_object('ok', false, 'code', 'non_inscrit', 'prenom', v_prenom, 'nom', v_nom);
  end if;

  if v_statut = 'liste_attente' then
    if not p_faire_entrer then
      return jsonb_build_object('ok', false, 'code', 'remplacant', 'prenom', v_prenom, 'nom', v_nom);
    end if;
    update public.inscriptions set statut = 'disponible', proposition_expire = null where id = v_insc;
  end if;

  if v_sjm in ('present_ponctuel', 'present_retard') then
    return jsonb_build_object('ok', true, 'code', 'deja', 'prenom', v_prenom, 'nom', v_nom, 'poste', v_poste,
                              'statut_jour_match', v_sjm,
                              'pointe_le', (select i.pointe_le from public.inscriptions i where i.id = v_insc));
  end if;

  v_ref := public.heure_arrivee_attendue(v_bid, p_match_id);
  v_now := (now() at time zone 'Europe/Paris')::time;
  v_retard := greatest(0, floor(extract(epoch from (v_now - v_ref)) / 60)::int);
  v_new := case when v_ref is null or v_now <= v_ref + interval '10 minutes' then 'present_ponctuel' else 'present_retard' end;

  update public.inscriptions set statut_jour_match = v_new, pointe_le = now(),
         validee_par = auth.uid(), validee_le = now()
  where id = v_insc;

  return jsonb_build_object('ok', true, 'code', 'pointe', 'prenom', v_prenom, 'nom', v_nom, 'poste', v_poste,
                            'statut_jour_match', v_new, 'retard_min', case when v_new = 'present_retard' then v_retard else 0 end,
                            'heure_attendue', to_char(v_ref, 'HH24"h"MI'),
                            'entre_en_jeu', v_statut = 'liste_attente');
end; $$;
revoke all on function public.pointer_benevole(text, uuid, boolean) from public, anon;
grant execute on function public.pointer_benevole(text, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- B. NOTIFICATIONS PUSH (file d'attente + appel immédiat de l'Edge Function)
-- ---------------------------------------------------------------------
create table if not exists public.push_outbox (
  id          uuid primary key default gen_random_uuid(),
  benevole_id uuid not null references public.benevoles(id) on delete cascade,
  title       text not null,
  body        text,
  url         text,
  tag         text,
  status      text not null default 'pending',
  attempts    int not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
alter table public.push_outbox enable row level security;
drop policy if exists push_outbox_pilote_read on public.push_outbox;
create policy push_outbox_pilote_read on public.push_outbox
  for select to authenticated using (public.is_admin_or_pilote());
create index if not exists idx_push_outbox_pending on public.push_outbox(status, created_at);

create or replace function public.queue_push(p_benevole uuid, p_title text, p_body text, p_url text default '/dashboard.html', p_tag text default 'spacers')
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.push_outbox (benevole_id, title, body, url, tag)
  values (p_benevole, p_title, p_body, coalesce(p_url, '/dashboard.html'), coalesce(p_tag, 'spacers'));
  begin
    perform net.http_post(
      url     := 'https://xphuolvbamdkizydveij.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := '{}'::jsonb
    );
  exception when others then null;  -- le cron de secours reprendra
  end;
end; $$;
revoke all on function public.queue_push(uuid, text, text, text, text) from public, anon, authenticated;

-- Push sur les événements remplaçants (appelé / invité)
create or replace function public.tg_remplacants_push()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_adv text;
begin
  v_adv := (select m.adversaire from public.matchs m where m.id = new.match_id);
  if old.statut = 'liste_attente' and new.statut = 'disponible' then
    perform public.queue_push(new.benevole_id, '🎉 Tu entres en jeu !',
      'Tu fais partie de l''équipe bénévole de Spacers vs ' || coalesce(v_adv,'') || '. Ton planning arrive bientôt.',
      '/dashboard.html?match=' || new.match_id, 'remp-' || new.match_id);
  end if;
  if new.statut = 'liste_attente' and new.invitation_tribune and not coalesce(old.invitation_tribune, false) then
    perform public.queue_push(new.benevole_id, '🎟️ Ta place en tribune t''attend',
      'Le club t''offre ta place pour Spacers vs ' || coalesce(v_adv,'') || '. Billet par e-mail au plus tard la veille.',
      '/dashboard.html?match=' || new.match_id, 'invit-' || new.match_id);
  end if;
  return new;
exception when others then
  raise warning 'tg_remplacants_push: %', sqlerrm;
  return new;
end; $$;
drop trigger if exists trg_zz_remplacants_push on public.inscriptions;
create trigger trg_zz_remplacants_push
  after update of statut, invitation_tribune on public.inscriptions
  for each row execute function public.tg_remplacants_push();

-- ---------------------------------------------------------------------
-- C. APPEL AUTOMATIQUE + CONFIRMATION
-- ---------------------------------------------------------------------
alter table public.inscriptions add column if not exists proposition_expire timestamptz;

-- Plafond v4 : un remplaçant qui confirme une place proposée passe toujours
create or replace function public.tg_plafond_benevoles_match()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_max int; v_n int;
begin
  if new.statut = 'liste_attente' then
    if new.liste_attente_le is null then new.liste_attente_le := now(); end if;
    return new;
  end if;
  -- on quitte la liste des remplaçants : la proposition éventuelle tombe
  new.proposition_expire := null;

  if new.statut is distinct from 'disponible' then return new; end if;
  if tg_op = 'UPDATE' and old.statut = 'disponible' then return new; end if;
  if tg_op = 'UPDATE' and old.statut = 'liste_attente' and old.proposition_expire > now() then
    return new;  -- confirmation d'une place proposée : toujours acceptée
  end if;

  if tg_op = 'INSERT' and exists (
       select 1 from public.inscriptions
       where benevole_id = new.benevole_id and match_id = new.match_id) then
    return new;
  end if;

  if public.is_admin_or_pilote() then return new; end if;

  perform 1 from public.matchs where id = new.match_id for update;
  v_max := (select m.benevoles_max from public.matchs m where m.id = new.match_id);
  if v_max is null or v_max <= 0 then return new; end if;

  -- places réservées par une proposition en cours = occupées
  v_n := (select count(*) from public.inscriptions x
           where x.match_id = new.match_id and x.benevole_id <> new.benevole_id
             and (x.statut = 'disponible' or (x.statut = 'liste_attente' and x.proposition_expire > now())));

  if v_n >= v_max and not public.a_priorite_remplacant(new.benevole_id, new.match_id) then
    new.statut := 'liste_attente';
    new.liste_attente_le := coalesce(new.liste_attente_le, now());
  end if;
  return new;
end; $$;

-- Propose les places libres aux remplaçants suivants. Renvoie le nombre de propositions.
create or replace function public.proposer_places(p_match_id uuid)
returns int language plpgsql security definer set search_path to 'public' as $$
declare
  v_max int; v_occ int; v_n int := 0; v_next uuid; v_bid uuid; v_debut timestamptz; v_deadline timestamptz;
  v_adv text; v_date text; v_heure text; v_lim text; v_b record; v_p record; v_prenom text; v_nom text;
begin
  v_max := (select m.benevoles_max from public.matchs m where m.id = p_match_id);
  if v_max is null or v_max <= 0 then return 0; end if;
  v_debut := (select (m.date_match + coalesce(m.heure, '20:00'::time)) at time zone 'Europe/Paris' from public.matchs m where m.id = p_match_id);
  if v_debut is null or v_debut < now() then return 0; end if;
  v_adv := (select m.adversaire from public.matchs m where m.id = p_match_id);
  v_date := (select to_char(m.date_match, 'DD/MM/YYYY') from public.matchs m where m.id = p_match_id);
  v_heure := (select coalesce(' à ' || to_char(m.heure, 'HH24"h"MI'), '') from public.matchs m where m.id = p_match_id);

  loop
    v_occ := (select count(*) from public.inscriptions x
              where x.match_id = p_match_id
                and (x.statut = 'disponible' or (x.statut = 'liste_attente' and x.proposition_expire > now())));
    exit when v_occ >= v_max;

    v_next := (select x.id from public.inscriptions x
               where x.match_id = p_match_id and x.statut = 'liste_attente'
                 and (x.proposition_expire is null)
               order by public.a_priorite_remplacant(x.benevole_id, x.match_id) desc,
                        coalesce(x.liste_attente_le, x.created_at)
               limit 1);
    exit when v_next is null;

    v_deadline := greatest(least(now() + interval '24 hours', v_debut - interval '2 hours'), now() + interval '1 hour');
    update public.inscriptions set proposition_expire = v_deadline where id = v_next;
    v_bid := (select x.benevole_id from public.inscriptions x where x.id = v_next);
    v_prenom := (select b.prenom from public.benevoles b where b.id = v_bid);
    v_nom := (select b.nom from public.benevoles b where b.id = v_bid);
    v_lim := to_char(v_deadline at time zone 'Europe/Paris', 'DD/MM "à" HH24"h"MI');
    v_n := v_n + 1;

    -- bénévole : push + e-mail
    perform public.queue_push(v_bid, '🔔 Une place s''est libérée pour toi !',
      'Spacers vs ' || coalesce(v_adv,'') || ' : confirme ta place avant le ' || v_lim || '.',
      '/dashboard.html?match=' || p_match_id, 'prop-' || p_match_id);
    for v_b in select b.prenom, b.email from public.benevoles b
               where b.id = v_bid and b.email is not null and b.email not like '%@spacers-deleted.local' loop
      insert into public.email_outbox (to_email, to_name, subject, body_html, body_text, template_key, metadata, match_id, benevole_id, type_email)
      values (v_b.email, coalesce(v_b.prenom,''),
        '🔔 Une place s''est libérée : confirme avant le ' || v_lim,
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a18;">'
        ||'<h2 style="color:#042C53;">Une place s''est libérée pour toi 🏐</h2>'
        ||'<p>Bonjour '||coalesce(v_b.prenom,'')||',</p>'
        ||'<p>Tu étais remplaçant pour <strong>Spacers vs '||coalesce(v_adv,'')||'</strong> du '||v_date||v_heure||' : une place vient de se libérer et elle est <strong>réservée pour toi</strong>.</p>'
        ||'<p style="background:#FEF6E0;border-radius:8px;padding:12px;"><strong>Confirme dans l''app avant le '||v_lim||'.</strong> Passé ce délai, la place sera proposée au remplaçant suivant.</p>'
        ||'<p style="margin-top:20px;"><a href="https://benevoles.spacerstoulouse.fr/dashboard.html?match='||p_match_id||'" style="background:#185FA5;color:white;border-radius:50px;padding:12px 20px;text-decoration:none;font-weight:700;">Je confirme ma place</a></p>'
        ||'<p style="color:#5A7291;font-size:13px;">Tu ne peux pas venir ? Indique-le dans l''app : tu restes remplaçant et la place passe au suivant. — L''équipe des pilotes Spacers</p></div>',
        'Une place s''est liberee pour Spacers vs '||coalesce(v_adv,'')||' du '||v_date||'. Confirme dans l''app avant le '||v_lim||'.',
        'remplacant_proposition', jsonb_build_object('benevole_id', v_bid, 'match_id', p_match_id),
        p_match_id, v_bid, 'remplacant_proposition');
    end loop;

    -- pilotes : information
    for v_p in select b.prenom, b.email from public.benevoles b
               where b.role in ('pilote','admin') and b.statut_compte = 'actif'
                 and b.email is not null and b.email not like '%@spacers-deleted.local' loop
      insert into public.email_outbox (to_email, to_name, subject, body_html, body_text, template_key, metadata, match_id, type_email)
      values (v_p.email, coalesce(v_p.prenom,''),
        '🔁 Place proposée à ' || coalesce(v_prenom,'') || ' ' || coalesce(v_nom,'') || ' — ' || coalesce(v_adv,''),
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1a1a18;">'
        ||'<h2 style="color:#042C53;">Place libérée : remplaçant appelé automatiquement</h2>'
        ||'<p>Bonjour '||coalesce(v_p.prenom,'')||',</p>'
        ||'<p>Une place s''est libérée pour <strong>Spacers vs '||coalesce(v_adv,'')||'</strong> du '||v_date||v_heure||'. Elle a été proposée à <strong>'||coalesce(v_prenom,'')||' '||coalesce(v_nom,'')||'</strong>, qui a jusqu''au '||v_lim||' pour confirmer. Sans réponse, le remplaçant suivant sera appelé automatiquement.</p>'
        ||'<p>Rien à faire de ton côté. Tu peux toujours forcer un remplaçant avec « ✅ Valider » dans l''écran Match.</p></div>',
        'Place proposee a '||coalesce(v_prenom,'')||' '||coalesce(v_nom,'')||' pour Spacers vs '||coalesce(v_adv,'')||', confirmation avant le '||v_lim||'.',
        'remplacant_proposition_pilote', jsonb_build_object('match_id', p_match_id, 'benevole_id', v_bid),
        p_match_id, 'remplacant_proposition_pilote');
    end loop;
  end loop;
  return v_n;
end; $$;
revoke all on function public.proposer_places(uuid) from public, anon, authenticated;

-- Un désistement libère une place -> appel automatique
create or replace function public.tg_appel_auto_remplacant()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (old.statut = 'disponible' and new.statut <> 'disponible')
     or (old.statut = 'liste_attente' and old.proposition_expire > now()
         and new.statut not in ('disponible', 'liste_attente')) then
    perform public.proposer_places(new.match_id);
  end if;
  return new;
exception when others then
  raise warning 'tg_appel_auto_remplacant: %', sqlerrm;
  return new;
end; $$;
drop trigger if exists trg_zz_appel_auto_remplacant on public.inscriptions;
create trigger trg_zz_appel_auto_remplacant
  after update of statut on public.inscriptions
  for each row execute function public.tg_appel_auto_remplacant();

-- Le pilote augmente le plafond -> appel automatique
create or replace function public.tg_appel_auto_plafond()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(new.benevoles_max, 0) > coalesce(old.benevoles_max, 0) then
    perform public.proposer_places(new.id);
  end if;
  return new;
exception when others then
  raise warning 'tg_appel_auto_plafond: %', sqlerrm;
  return new;
end; $$;
drop trigger if exists trg_zz_appel_auto_plafond on public.matchs;
create trigger trg_zz_appel_auto_plafond
  after update of benevoles_max on public.matchs
  for each row execute function public.tg_appel_auto_plafond();

-- E-mails remplaçants : l'alerte pilote "place libérée" est remplacée par l'appel automatique
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

  end loop;
  return new;
exception when others then
  raise warning 'tg_remplacants_emails: %', sqlerrm;  -- un e-mail ne doit jamais bloquer une inscription
  return new;
end; $$;



-- Le remplaçant confirme / décline
create or replace function public.confirmer_place(p_match_id uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'non_authentifie'; end if;
  v_id := (select i.id from public.inscriptions i
           where i.match_id = p_match_id and i.benevole_id = auth.uid()
             and i.statut = 'liste_attente' and i.proposition_expire > now());
  if v_id is null then return 'expiree'; end if;
  update public.inscriptions set statut = 'disponible' where id = v_id;
  return 'ok';
end; $$;
revoke all on function public.confirmer_place(uuid) from public, anon;
grant execute on function public.confirmer_place(uuid) to authenticated;

create or replace function public.decliner_place(p_match_id uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'non_authentifie'; end if;
  v_id := (select i.id from public.inscriptions i
           where i.match_id = p_match_id and i.benevole_id = auth.uid()
             and i.statut = 'liste_attente' and i.proposition_expire is not null);
  if v_id is null then return 'aucune'; end if;
  update public.inscriptions set proposition_expire = null, liste_attente_le = now() where id = v_id;
  perform public.proposer_places(p_match_id);
  return 'ok';
end; $$;
revoke all on function public.decliner_place(uuid) from public, anon;
grant execute on function public.decliner_place(uuid) to authenticated;

-- Expiration des propositions (cron toutes les 15 min)
create or replace function public.expirer_propositions()
returns int language plpgsql security definer set search_path to 'public' as $$
declare r record; v_n int := 0;
begin
  for r in select distinct x.match_id as mid from public.inscriptions x
           where x.statut = 'liste_attente' and x.proposition_expire is not null and x.proposition_expire <= now() loop
    update public.inscriptions set proposition_expire = null, liste_attente_le = now()
    where match_id = r.mid and statut = 'liste_attente' and proposition_expire is not null and proposition_expire <= now();
    v_n := v_n + public.proposer_places(r.mid);
  end loop;
  return v_n;
end; $$;
revoke all on function public.expirer_propositions() from public, anon, authenticated;

-- Statut remplaçant (vue bénévole) : + proposition_expire
drop function if exists public.mon_statut_remplacant(uuid);
create function public.mon_statut_remplacant(p_match_id uuid)
returns table (position_attente int, nb_remplacants int, nb_dispos int, plafond int,
               invitation_tribune boolean, sur_place boolean, prioritaire boolean, billet_envoye boolean,
               proposition_expire timestamptz)
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
      (select i.billet_envoye from public.inscriptions i where i.match_id = p_match_id and i.benevole_id = v_uid),
      (select case when i.proposition_expire > now() then i.proposition_expire end
         from public.inscriptions i where i.match_id = p_match_id and i.benevole_id = v_uid);
end; $$;
revoke all on function public.mon_statut_remplacant(uuid) from public, anon;
grant execute on function public.mon_statut_remplacant(uuid) to authenticated;

-- Liste pilote : + proposition_expire
drop function if exists public.remplacants_du_match(uuid);
create function public.remplacants_du_match(p_match_id uuid)
returns table (inscription_id uuid, benevole_id uuid, prenom text, nom text, matchs_joues int,
               depuis timestamptz, invitation_tribune boolean, sur_place boolean, prioritaire boolean,
               billet_envoye boolean, email text, proposition_expire timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_admin_or_pilote() then raise exception 'Réservé aux pilotes'; end if;
  return query
    select i.id, i.benevole_id, b.prenom::text, b.nom::text, b.matchs_joues,
           coalesce(i.liste_attente_le, i.created_at), i.invitation_tribune, i.sur_place,
           public.a_priorite_remplacant(i.benevole_id, i.match_id),
           i.billet_envoye, b.email::text,
           case when i.proposition_expire > now() then i.proposition_expire end
    from public.inscriptions i
    join public.benevoles b on b.id = i.benevole_id
    where i.match_id = p_match_id and i.statut = 'liste_attente'
    order by (i.proposition_expire > now()) is true desc,
             public.a_priorite_remplacant(i.benevole_id, i.match_id) desc,
             coalesce(i.liste_attente_le, i.created_at);
end; $$;
revoke all on function public.remplacants_du_match(uuid) from public, anon;
grant execute on function public.remplacants_du_match(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- E. ÉQUITÉ DE ROTATION (vue pilote)
-- ---------------------------------------------------------------------
create or replace function public.stats_rotation()
returns table (benevole_id uuid, matchs_saison int, dernier_match date, nb_remplacant int,
               nb_absences int, nb_a_venir int)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_debut date;
begin
  if not public.is_admin_or_pilote() then raise exception 'Réservé aux pilotes'; end if;
  v_debut := coalesce((select s.date_debut from public.saisons s where s.active limit 1), date '2026-07-01');
  return query
    select b.id,
      (select count(*)::int from public.inscriptions i join public.matchs m on m.id = i.match_id
        where i.benevole_id = b.id and i.statut = 'disponible' and m.date_match < current_date
          and m.date_match >= v_debut and coalesce(i.statut_jour_match, '') <> 'absent'),
      (select max(m.date_match) from public.inscriptions i join public.matchs m on m.id = i.match_id
        where i.benevole_id = b.id and i.statut = 'disponible' and m.date_match < current_date
          and coalesce(i.statut_jour_match, '') <> 'absent'),
      (select count(*)::int from public.inscriptions i join public.matchs m on m.id = i.match_id
        where i.benevole_id = b.id and i.statut = 'liste_attente' and m.date_match >= v_debut),
      (select count(*)::int from public.inscriptions i join public.matchs m on m.id = i.match_id
        where i.benevole_id = b.id and i.statut_jour_match = 'absent' and m.date_match >= v_debut),
      (select count(*)::int from public.inscriptions i join public.matchs m on m.id = i.match_id
        where i.benevole_id = b.id and i.statut = 'disponible' and m.date_match >= current_date)
    from public.benevoles b
    where b.statut_compte = 'actif';
end; $$;
revoke all on function public.stats_rotation() from public, anon;
grant execute on function public.stats_rotation() to authenticated;

-- ---------------------------------------------------------------------
-- Tâches planifiées
-- ---------------------------------------------------------------------
do $$ begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname in ('remplacants-expiration', 'push-outbox-secours');
  perform cron.schedule('remplacants-expiration', '*/15 * * * *', 'select public.expirer_propositions()');
  perform cron.schedule('push-outbox-secours', '*/5 * * * *',
    $cmd$select net.http_post(url := 'https://xphuolvbamdkizydveij.supabase.co/functions/v1/send-push', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb)$cmd$);
end $$;

-- Contrôle
select jobname, schedule from cron.job where jobname in ('remplacants-expiration', 'push-outbox-secours', 'remplacants-recap-billetterie') order by jobname;
