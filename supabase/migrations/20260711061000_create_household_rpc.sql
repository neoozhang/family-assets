create or replace function public.create_household(household_name text default '我的家庭')
returns public.households
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_household public.households;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if household_name is null or char_length(trim(household_name)) = 0 then
    household_name := '我的家庭';
  end if;

  insert into public.households (name, created_by)
  values (left(trim(household_name), 60), auth.uid())
  returning * into created_household;

  return created_household;
end;
$$;

revoke all on function public.create_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
