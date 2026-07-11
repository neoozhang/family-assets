create extension if not exists pgcrypto;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.accounts (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null,
  name text not null default '',
  type text not null,
  institution text not null default '',
  currency text not null default 'CNY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

create table public.snapshots (
  household_id uuid not null,
  id text not null,
  account_id text not null,
  snapshot_date date not null,
  balance numeric(18, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, id),
  unique (household_id, account_id, snapshot_date),
  foreign key (household_id, account_id)
    references public.accounts(household_id, id) on delete cascade
);

create table public.household_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  selected_year integer not null default extract(year from current_date)::integer,
  updated_at timestamptz not null default now()
);

create index household_members_user_id_idx on public.household_members(user_id);
create index accounts_household_id_idx on public.accounts(household_id);
create index snapshots_household_date_idx on public.snapshots(household_id, snapshot_date desc);
create index snapshots_account_date_idx on public.snapshots(household_id, account_id, snapshot_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create trigger snapshots_set_updated_at
before update on public.snapshots
for each row execute function public.set_updated_at();

create trigger household_settings_set_updated_at
before update on public.household_settings
for each row execute function public.set_updated_at();

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function public.add_household_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  insert into public.household_settings (household_id)
  values (new.id);

  return new;
end;
$$;

create trigger households_add_owner
after insert on public.households
for each row execute function public.add_household_owner();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.snapshots enable row level security;
alter table public.household_settings enable row level security;

create policy households_select_members
on public.households for select
to authenticated
using (public.is_household_member(id));

create policy households_insert_creator
on public.households for insert
to authenticated
with check (created_by = auth.uid());

create policy households_update_owner
on public.households for update
to authenticated
using (public.is_household_owner(id))
with check (public.is_household_owner(id));

create policy households_delete_owner
on public.households for delete
to authenticated
using (public.is_household_owner(id));

create policy household_members_select_members
on public.household_members for select
to authenticated
using (public.is_household_member(household_id));

create policy household_members_insert_owner
on public.household_members for insert
to authenticated
with check (public.is_household_owner(household_id));

create policy household_members_update_owner
on public.household_members for update
to authenticated
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

create policy household_members_delete_owner
on public.household_members for delete
to authenticated
using (public.is_household_owner(household_id));

create policy accounts_select_members
on public.accounts for select
to authenticated
using (public.is_household_member(household_id));

create policy accounts_insert_members
on public.accounts for insert
to authenticated
with check (public.is_household_member(household_id));

create policy accounts_update_members
on public.accounts for update
to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy accounts_delete_members
on public.accounts for delete
to authenticated
using (public.is_household_member(household_id));

create policy snapshots_select_members
on public.snapshots for select
to authenticated
using (public.is_household_member(household_id));

create policy snapshots_insert_members
on public.snapshots for insert
to authenticated
with check (public.is_household_member(household_id));

create policy snapshots_update_members
on public.snapshots for update
to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy snapshots_delete_members
on public.snapshots for delete
to authenticated
using (public.is_household_member(household_id));

create policy household_settings_select_members
on public.household_settings for select
to authenticated
using (public.is_household_member(household_id));

create policy household_settings_insert_members
on public.household_settings for insert
to authenticated
with check (public.is_household_member(household_id));

create policy household_settings_update_members
on public.household_settings for update
to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

revoke all on public.households from anon;
revoke all on public.household_members from anon;
revoke all on public.accounts from anon;
revoke all on public.snapshots from anon;
revoke all on public.household_settings from anon;

grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.snapshots to authenticated;
grant select, insert, update, delete on public.household_settings to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
