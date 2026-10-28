-- Apply once in the existing Solar Supabase project (SQL editor). No client write policies.
create table if not exists public.solar_billing_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  livemode boolean not null,
  customer_id text,
  checkout_id text,
  checkout_request uuid,
  checkout_plan text check (checkout_plan in ('pro','max')),
  lease_token uuid,
  lease_until timestamptz,
  primary key (user_id,livemode), unique(customer_id,livemode)
);
create table if not exists public.solar_billing_events (
  event_id text not null, livemode boolean not null, customer_id text not null,
  received_at timestamptz not null default now(), verified_state jsonb not null,
  primary key(event_id,livemode)
);
alter table public.solar_billing_accounts enable row level security;
alter table public.solar_billing_events enable row level security;
revoke all on public.solar_billing_accounts, public.solar_billing_events from public, anon, authenticated;
grant select, insert, update on public.solar_billing_accounts to service_role;
grant select, insert on public.solar_billing_events to service_role;
create or replace function public.solar_billing_claim(p_user uuid,p_live boolean,p_token uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
  update public.solar_billing_accounts set lease_token=p_token,lease_until=now()+interval '5 minutes'
  where user_id=p_user and livemode=p_live and (lease_until is null or lease_until<now());
  return found;
end $$;
revoke all on function public.solar_billing_claim(uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.solar_billing_claim(uuid,boolean,uuid) to service_role;
