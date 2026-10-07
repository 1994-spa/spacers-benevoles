-- Spacers Bénévoles — 2026-10-07 — Récap billets remplaçants : uniquement à J-1 (9h Paris)
create or replace function public.recap_invitations_remplacants_j1()
returns int language plpgsql security definer set search_path to 'public' as $$
declare r record; v_total int := 0;
begin
  for r in select m.id from public.matchs m where m.date_match = current_date + 1 loop
    v_total := v_total + public.recap_invitations_remplacants(r.id);
  end loop;
  return v_total;
end; $$;
revoke all on function public.recap_invitations_remplacants_j1() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'remplacants-recap-billetterie';
  perform cron.schedule('remplacants-recap-billetterie', '0 7 * * *', 'select public.recap_invitations_remplacants_j1()');
end $$;

select jobname, schedule, command from cron.job where jobname = 'remplacants-recap-billetterie';
