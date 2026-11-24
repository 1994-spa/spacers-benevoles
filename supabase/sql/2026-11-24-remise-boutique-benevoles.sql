-- ============================================================
-- 2026-11-24 - Remise boutique du Palais pour les benevoles
-- Avantage de statut : les Satellites ont -10 % toute la saison a la
-- boutique physique (stand du Palais), sur scan de leur accreditation.
-- Pas de debit de points. Non valable sur la boutique en ligne.
--
-- Contenu :
--   1. paliers.remise_boutique_pct       (taux par palier)
--   2. remises_boutique                  (journal des remises accordees)
--   3. boutique_verifier_benevole()      (lecture seule, appelee au scan)
--   4. boutique_enregistrer_remise()     (ecrit le journal a l'encaissement)
--
-- Securite : les 2 fonctions sont SECURITY DEFINER et reservees a
-- service_role (appel depuis le serveur de la caisse, jamais depuis le
-- navigateur). Elles ne renvoient que prenom, initiale du nom, palier
-- et taux de remise.
-- Migration additive et idempotente.
-- ============================================================

-- 1. Taux de remise par palier ---------------------------------
alter table public.paliers
  add column if not exists remise_boutique_pct integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'paliers_remise_boutique_pct_chk') then
    alter table public.paliers
      add constraint paliers_remise_boutique_pct_chk
      check (remise_boutique_pct between 0 and 100);
  end if;
end $$;

-- Decision du 24/11/2026 : Satellite = 10 %.
-- Etoile et Galaxie restent a 0 tant que leur taux n'est pas arrete :
-- la fonction applique le meilleur taux parmi les paliers atteints,
-- donc une Etoile garde au minimum les 10 % du Satellite.
update public.paliers set remise_boutique_pct = 10 where code = 'satellite';

-- 2. Journal des remises accordees -----------------------------
create table if not exists public.remises_boutique (
  id                uuid primary key default gen_random_uuid(),
  benevole_id       uuid not null references public.benevoles(id) on delete cascade,
  saison            text,
  palier_code       text not null,
  remise_pct        integer not null check (remise_pct between 1 and 100),
  montant_avant_eur numeric(8,2) check (montant_avant_eur is null or montant_avant_eur >= 0),
  montant_remise_eur numeric(8,2) check (montant_remise_eur is null or montant_remise_eur >= 0),
  match_id          uuid references public.matchs(id) on delete set null,
  date_achat        date not null default ((now() at time zone 'Europe/Paris')::date),
  source            text not null default 'caisse_boutique',
  cree_le           timestamptz not null default now()
);

create index if not exists remises_boutique_benevole_date_idx
  on public.remises_boutique (benevole_id, date_achat);

alter table public.remises_boutique enable row level security;

-- Lecture : le benevole voit ses propres remises, les pilotes voient tout.
-- Aucune policy d'ecriture : seul service_role (via la fonction) ecrit.
drop policy if exists remises_boutique_select_self_or_pilote on public.remises_boutique;
create policy remises_boutique_select_self_or_pilote
  on public.remises_boutique
  for select to authenticated
  using (benevole_id = auth.uid() or public.is_admin_or_pilote());

revoke all on public.remises_boutique from anon;
revoke insert, update, delete, truncate, references, trigger on public.remises_boutique from authenticated;

-- 3. Verification au scan (lecture seule) ----------------------
create or replace function public.boutique_verifier_benevole(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_tok    text;
  v_bid    uuid;
  v_prenom text;
  v_nom    text;
  v_total  integer;
  v_code   text;
  v_lib    text;
  v_emoji  text;
  v_pct    integer;
  v_deja   integer;
begin
  -- Meme normalisation que pointer_benevole : "SPB:<32 hexa>"
  v_tok := upper(regexp_replace(coalesce(p_token, ''), '^.*SPB:', '', 'i'));
  v_tok := regexp_replace(v_tok, '[^A-F0-9]', '', 'g');
  if length(v_tok) <> 32 then
    return jsonb_build_object('ok', false, 'code', 'inconnu');
  end if;

  select b.id, b.prenom, b.nom
    into v_bid, v_prenom, v_nom
    from public.benevoles b
   where b.qr_token = v_tok
     and b.statut_compte = 'actif';
  if v_bid is null then
    return jsonb_build_object('ok', false, 'code', 'inconnu');
  end if;

  select vp.total, vp.palier_code, vp.palier, vp.palier_emoji
    into v_total, v_code, v_lib, v_emoji
    from public.v_benevole_palier vp
   where vp.benevole_id = v_bid;

  -- Meilleur taux parmi les paliers atteints
  select coalesce(max(p.remise_boutique_pct), 0)
    into v_pct
    from public.paliers p
   where p.seuil <= coalesce(v_total, 0);

  select count(*)
    into v_deja
    from public.remises_boutique r
   where r.benevole_id = v_bid
     and r.date_achat = (now() at time zone 'Europe/Paris')::date;

  return jsonb_build_object(
    'ok',              v_pct > 0,
    'code',            case when v_pct > 0 then 'ok' else 'sans_remise' end,
    'prenom',          v_prenom,
    'nom_initiale',    upper(left(coalesce(v_nom, ''), 1)),
    'palier_code',     v_code,
    'palier',          v_lib,
    'palier_emoji',    v_emoji,
    'remise_pct',      v_pct,
    'deja_aujourdhui', v_deja
  );
end;
$$;

-- 4. Enregistrement a l'encaissement ---------------------------
create or replace function public.boutique_enregistrer_remise(
  p_token          text,
  p_montant_avant  numeric default null,
  p_montant_remise numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_chk   jsonb;
  v_tok   text;
  v_bid   uuid;
  v_id    uuid;
  v_today date := (now() at time zone 'Europe/Paris')::date;
begin
  v_chk := public.boutique_verifier_benevole(p_token);
  if not coalesce((v_chk->>'ok')::boolean, false) then
    return v_chk;
  end if;

  v_tok := upper(regexp_replace(coalesce(p_token, ''), '^.*SPB:', '', 'i'));
  v_tok := regexp_replace(v_tok, '[^A-F0-9]', '', 'g');
  select b.id into v_bid from public.benevoles b where b.qr_token = v_tok;

  insert into public.remises_boutique
    (benevole_id, saison, palier_code, remise_pct,
     montant_avant_eur, montant_remise_eur, match_id, date_achat)
  values
    (v_bid,
     (select s.code from public.saisons s where s.active limit 1),
     v_chk->>'palier_code',
     (v_chk->>'remise_pct')::integer,
     p_montant_avant,
     p_montant_remise,
     (select m.id from public.matchs m where m.date_match = v_today order by m.heure nulls last limit 1),
     v_today)
  returning id into v_id;

  return v_chk || jsonb_build_object('remise_id', v_id);
end;
$$;

-- Droits : service_role uniquement (meme regle que award_points)
revoke all on function public.boutique_verifier_benevole(text) from public, anon, authenticated;
revoke all on function public.boutique_enregistrer_remise(text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.boutique_verifier_benevole(text) to service_role;
grant execute on function public.boutique_enregistrer_remise(text, numeric, numeric) to service_role;

comment on table public.remises_boutique is
  'Journal des remises boutique du Palais accordees aux benevoles sur scan de leur accreditation (avantage de palier, sans debit de points).';
comment on column public.paliers.remise_boutique_pct is
  'Remise en % a la boutique physique du Palais. La fonction boutique_verifier_benevole applique le meilleur taux parmi les paliers atteints.';

-- 5. Complement du 25/11/2026 ----------------------------------
-- Taux Etoile et Galaxie valides (grille deja annoncee dans l'app).
update public.paliers set remise_boutique_pct = 20 where code = 'etoile';
update public.paliers set remise_boutique_pct = 30 where code = 'galaxie';

-- Purge mensuelle du journal : 24 mois apres l'achat
-- (duree annoncee dans la politique de confidentialite v1.3).
select cron.unschedule(jobid) from cron.job where jobname = 'remises-boutique-purge';
select cron.schedule(
  'remises-boutique-purge',
  '23 3 1 * *',
  $$delete from public.remises_boutique where date_achat < ((now() at time zone 'Europe/Paris')::date - interval '24 months')$$
);
