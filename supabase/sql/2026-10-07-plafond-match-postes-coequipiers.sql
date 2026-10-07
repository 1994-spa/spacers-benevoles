-- =====================================================================
-- Spacers Bénévoles — 2026-10-07
--   A. Plafond de bénévoles par match (35 par défaut) + liste d'attente
--   B. Minimum / maximum de bénévoles par poste
--   C. RPC mes_coequipiers : qui est avec moi sur mon poste
-- A coller tel quel dans le SQL Editor Supabase (idempotent).
-- v2 : affectations par := uniquement (compatibilite editeur Supabase).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Garde-fou : une contrainte CHECK sur inscriptions.statut bloquerait
--    la nouvelle valeur 'liste_attente'. On s'arrête si c'est le cas.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.inscriptions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ~ '\mstatut\M' and pg_get_constraintdef(oid) !~ 'statut_jour_match'
      and pg_get_constraintdef(oid) !~ 'liste_attente'
  loop
    raise exception 'Contrainte % sur inscriptions.statut sans liste_attente : %. Ajoute liste_attente a cette contrainte puis relance.', r.conname, r.def;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- A. PLAFOND PAR MATCH + LISTE D'ATTENTE
-- ---------------------------------------------------------------------
alter table public.matchs alter column benevoles_max set default 35;
update public.matchs set benevoles_max = 35 where date_match >= current_date;

alter table public.inscriptions add column if not exists liste_attente_le timestamptz;

create index if not exists idx_inscriptions_match_statut on public.inscriptions(match_id, statut);

-- Un bénévole qui passe "disponible" alors que le match est plein
-- bascule automatiquement en 'liste_attente' (pas d'erreur, pas de refus).
-- Les pilotes/admins passent outre le plafond (validation depuis la liste).
create or replace function public.tg_plafond_benevoles_match()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_max int; v_n int;
begin
  -- horodatage d'entrée en liste d'attente
  if new.statut = 'liste_attente' then
    if new.liste_attente_le is null then new.liste_attente_le := now(); end if;
    return new;
  end if;

  if new.statut is distinct from 'disponible' then return new; end if;
  if tg_op = 'UPDATE' and old.statut = 'disponible' then return new; end if;

  -- Upsert client (INSERT ... ON CONFLICT) : si la ligne existe déjà,
  -- on laisse la branche UPDATE trancher (après les autres gardes).
  if tg_op = 'INSERT' and exists (
       select 1 from public.inscriptions
       where benevole_id = new.benevole_id and match_id = new.match_id) then
    return new;
  end if;

  if public.is_admin_or_pilote() then return new; end if;

  -- verrou sur le match : deux inscriptions simultanées ne dépassent pas le plafond
  perform 1 from public.matchs where id = new.match_id for update;
  v_max := (select m.benevoles_max from public.matchs m where m.id = new.match_id);
  if v_max is null or v_max <= 0 then return new; end if;

  v_n := (select count(*) from public.inscriptions x
           where x.match_id = new.match_id and x.statut = 'disponible'
             and x.benevole_id <> new.benevole_id);

  if v_n >= v_max then
    new.statut := 'liste_attente';
    new.liste_attente_le := coalesce(new.liste_attente_le, now());
  end if;
  return new;
end; $$;

-- nom en "zz" : s'exécute APRÈS les gardes existantes (ordre alphabétique)
drop trigger if exists trg_zz_plafond_benevoles_match on public.inscriptions;
create trigger trg_zz_plafond_benevoles_match
  before insert or update of statut on public.inscriptions
  for each row execute function public.tg_plafond_benevoles_match();

-- ---------------------------------------------------------------------
-- B. MIN / MAX PAR POSTE
--    max = postes.benevoles_max_match (existant)  -> bloquant à l'affectation
--    min = postes.benevoles_min_match (nouveau)   -> alerte dans la couverture
-- ---------------------------------------------------------------------
alter table public.postes add column if not exists benevoles_min_match integer not null default 0;
do $$ begin
  alter table public.postes add constraint postes_min_positif check (benevoles_min_match >= 0);
exception when duplicate_object then null; end $$;

create or replace function public.poste_set_min(p_id uuid, p_min integer)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin_or_pilote() then raise exception 'Réservé aux pilotes'; end if;
  if p_min is null or p_min < 0 then raise exception 'Minimum invalide'; end if;
  update public.postes set benevoles_min_match = p_min where id = p_id;
end; $$;
revoke all on function public.poste_set_min(uuid, integer) from public, anon;
grant execute on function public.poste_set_min(uuid, integer) to authenticated;

-- Affectation au-delà du maximum du poste : refusée avec un message clair.
-- (max = 0 => pas de limite)
create or replace function public.tg_max_par_poste()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_max int; v_nom text; v_n int;
begin
  if new.poste_id is null or new.statut is distinct from 'disponible' then return new; end if;
  if tg_op = 'UPDATE' and new.poste_id is not distinct from old.poste_id
     and old.statut = 'disponible' then return new; end if;

  perform 1 from public.postes where id = new.poste_id for update;
  v_max := (select p.benevoles_max_match from public.postes p where p.id = new.poste_id);
  v_nom := (select p.nom from public.postes p where p.id = new.poste_id);
  if v_max is null or v_max <= 0 then return new; end if;

  v_n := (select count(*) from public.inscriptions x
           where x.match_id = new.match_id and x.poste_id = new.poste_id
             and x.statut = 'disponible' and x.id <> new.id);

  if v_n >= v_max then
    raise exception 'Poste complet : % a deja % benevole(s) (maximum %). Augmente le maximum dans l''onglet Postes si besoin.', v_nom, v_n, v_max
      using errcode = 'P0001';
  end if;
  return new;
end; $$;

drop trigger if exists trg_zz_max_par_poste on public.inscriptions;
create trigger trg_zz_max_par_poste
  before insert or update of poste_id, statut on public.inscriptions
  for each row execute function public.tg_max_par_poste();

-- ---------------------------------------------------------------------
-- C. MES COÉQUIPIERS
--    - planning détaillé (match_planning) : mêmes poste/libellé ET créneaux qui se chevauchent
--    - sinon : même poste principal (inscriptions.poste_id)
--    Ne renvoie que prénom + nom, et seulement à un bénévole inscrit au match.
-- ---------------------------------------------------------------------
create or replace function public.mes_coequipiers(p_match_id uuid)
returns table (poste text, bloc_debut time, bloc_fin time, prenom text, nom text)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_poste uuid;
begin
  if v_uid is null then return; end if;

  if not exists (select 1 from public.inscriptions i
                 where i.match_id = p_match_id and i.benevole_id = v_uid and i.statut = 'disponible') then
    return;
  end if;
  v_poste := (select i.poste_id from public.inscriptions i
              where i.match_id = p_match_id and i.benevole_id = v_uid limit 1);

  if exists (select 1 from public.match_planning mp where mp.match_id = p_match_id and mp.benevole_id = v_uid) then
    return query
      select distinct
        me.libelle::text, me.heure_debut::time, me.heure_fin::time,
        b.prenom::text, b.nom::text
      from public.match_planning me
      join public.match_planning o
        on o.match_id = me.match_id
       and o.benevole_id <> me.benevole_id
       and coalesce(o.poste_id::text, lower(o.libelle)) = coalesce(me.poste_id::text, lower(me.libelle))
       and o.heure_debut::time < coalesce(me.heure_fin::time, '23:59'::time)
       and me.heure_debut::time < coalesce(o.heure_fin::time, '23:59'::time)
      join public.inscriptions io
        on io.match_id = o.match_id and io.benevole_id = o.benevole_id and io.statut = 'disponible'
      join public.benevoles b on b.id = o.benevole_id
      where me.match_id = p_match_id and me.benevole_id = v_uid
      order by 2, 4;
  elsif v_poste is not null then
    return query
      select p.nom::text, null::time, null::time, b.prenom::text, b.nom::text
      from public.inscriptions i
      join public.benevoles b on b.id = i.benevole_id
      join public.postes p on p.id = i.poste_id
      where i.match_id = p_match_id and i.poste_id = v_poste
        and i.statut = 'disponible' and i.benevole_id <> v_uid
      order by 4;
  end if;
end; $$;
revoke all on function public.mes_coequipiers(uuid) from public, anon;
grant execute on function public.mes_coequipiers(uuid) to authenticated;

-- Contrôle
select id, adversaire, date_match, benevoles_max from public.matchs where date_match >= current_date order by date_match;
