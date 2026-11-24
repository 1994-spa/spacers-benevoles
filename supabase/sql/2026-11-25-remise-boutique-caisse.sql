-- ============================================================
-- 2026-11-25 - Remise boutique : branchement de la caisse (hors ligne)
--
-- La caisse boutique fonctionne sans internet au Palais. Elle ne peut
-- donc pas interroger la base a chaque scan : comme pour les cartes
-- abonnes, elle charge en wifi une liste d'EMPREINTES SHA-256 des QR
-- d'accreditation (jamais le QR en clair) avec prenom, initiale et taux.
-- Les remises accordees remontent ensuite par lot.
--
-- Circuit : tablette -> CRM Boutique (Apps Script, module
-- Benevoles_Remise.gs) -> ces 2 fonctions, avec une cle partagee.
--
-- Contenu :
--   1. remises_boutique.ref_caisse   (identifiant de vente, anti-doublon)
--   2. cle partagee 'boutique_cle' dans _app_secrets
--   3. boutique_liste_benevoles(p_cle)
--   4. boutique_enregistrer_remises(p_cle, p_remises)
--
-- A copier ensuite dans les proprietes du script CRM Boutique :
--   select value from public._app_secrets where key = 'boutique_cle';
-- Migration additive et idempotente.
-- ============================================================

-- 1. Anti-doublon ----------------------------------------------
alter table public.remises_boutique add column if not exists ref_caisse text;
create unique index if not exists remises_boutique_ref_caisse_uidx
  on public.remises_boutique (ref_caisse) where ref_caisse is not null;

-- 2. Cle partagee (generee ici, jamais ecrite dans le code) -----
insert into public._app_secrets (key, value)
select 'boutique_cle', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where not exists (select 1 from public._app_secrets where key = 'boutique_cle');

create or replace function public._boutique_cle_ok_(p_cle text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(length(p_cle) >= 32
     and p_cle = (select s.value from public._app_secrets s where s.key = 'boutique_cle'), false);
$$;

-- 3. Liste pour les tablettes ----------------------------------
-- Uniquement les benevoles actifs dont le palier donne une remise.
-- h = SHA-256 du jeton d'accreditation en majuscules (meme calcul cote caisse).
create or replace function public.boutique_liste_benevoles(p_cle text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public._boutique_cle_ok_(p_cle) then
    return jsonb_build_object('ok', false, 'code', 'cle_invalide');
  end if;

  return jsonb_build_object(
    'ok', true,
    'maj', now(),
    'benevoles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'h', encode(sha256(convert_to(upper(b.qr_token), 'UTF8')), 'hex'),
               'p', b.prenom,
               'f', upper(left(coalesce(b.nom, ''), 1)),
               't', x.pct))
        from public.benevoles b
        join public.v_benevole_palier vp on vp.benevole_id = b.id
        cross join lateral (
          select coalesce(max(p.remise_boutique_pct), 0) as pct
            from public.paliers p
           where p.seuil <= coalesce(vp.total, 0)
        ) x
       where b.statut_compte = 'actif'
         and b.qr_token is not null
         and x.pct > 0
    ), '[]'::jsonb)
  );
end;
$$;

-- 4. Journal des remises accordees (lot envoye par la caisse) ---
-- p_remises : [{ id, h, pct, brut, remise, ts, boutique }]
-- Idempotent : une vente deja recue (meme id) est ignoree.
create or replace function public.boutique_enregistrer_remises(p_cle text, p_remises jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r         jsonb;
  v_bid     uuid;
  v_pct     integer;
  v_date    date;
  v_recues  integer := 0;
  v_connues integer := 0;
  v_ignorees integer := 0;
  v_n       integer;
begin
  if not public._boutique_cle_ok_(p_cle) then
    return jsonb_build_object('ok', false, 'code', 'cle_invalide');
  end if;
  if p_remises is null or jsonb_typeof(p_remises) <> 'array' or jsonb_array_length(p_remises) > 500 then
    return jsonb_build_object('ok', false, 'code', 'lot_invalide');
  end if;

  for r in select * from jsonb_array_elements(p_remises) loop
    v_recues := v_recues + 1;
    v_pct := nullif(r->>'pct', '')::integer;
    select b.id into v_bid
      from public.benevoles b
     where encode(sha256(convert_to(upper(b.qr_token), 'UTF8')), 'hex') = lower(r->>'h');

    if v_bid is null or coalesce(r->>'id', '') = '' or v_pct is null or v_pct not between 1 and 100 then
      v_ignorees := v_ignorees + 1;
      continue;
    end if;

    v_date := coalesce(((r->>'ts')::timestamptz at time zone 'Europe/Paris')::date,
                       (now() at time zone 'Europe/Paris')::date);

    insert into public.remises_boutique
      (benevole_id, saison, palier_code, remise_pct, montant_avant_eur, montant_remise_eur,
       match_id, date_achat, source, ref_caisse)
    values
      (v_bid,
       (select s.code from public.saisons s where s.active limit 1),
       coalesce((select vp.palier_code from public.v_benevole_palier vp where vp.benevole_id = v_bid), 'inconnu'),
       v_pct,
       nullif(r->>'brut', '')::numeric,
       nullif(r->>'remise', '')::numeric,
       (select m.id from public.matchs m where m.date_match = v_date order by m.heure nulls last limit 1),
       v_date,
       'caisse_' || coalesce(nullif(r->>'boutique', ''), 'boutique'),
       r->>'id')
    on conflict (ref_caisse) where ref_caisse is not null do nothing;
    get diagnostics v_n = row_count;
    v_connues := v_connues + v_n;
  end loop;

  return jsonb_build_object('ok', true, 'recues', v_recues, 'enregistrees', v_connues, 'ignorees', v_ignorees);
end;
$$;

-- Droits : appel par le CRM avec la cle publique (anon) + la cle partagee.
revoke all on function public._boutique_cle_ok_(text) from public, anon, authenticated;
revoke all on function public.boutique_liste_benevoles(text) from public, authenticated;
revoke all on function public.boutique_enregistrer_remises(text, jsonb) from public, authenticated;
grant execute on function public.boutique_liste_benevoles(text) to anon, service_role;
grant execute on function public.boutique_enregistrer_remises(text, jsonb) to anon, service_role;
