-- Transactional fixture against the actual schema; no account is created and nothing is retained.
begin;
do $$
declare v_user uuid; v_token uuid:=gen_random_uuid(); v_other uuid:=gen_random_uuid();
begin
 select id into v_user from auth.users limit 1;
 if v_user is null then raise notice 'No existing account; lease fixture skipped'; return; end if;
 if exists(select 1 from public.solar_billing_accounts where user_id=v_user and livemode=false) then raise notice 'Test billing row already exists; lease fixture skipped'; return; end if;
 insert into public.solar_billing_accounts(user_id,livemode) values(v_user,false);
 if not public.solar_billing_claim(v_user,false,v_token) then raise exception 'First lease rejected'; end if;
 if public.solar_billing_claim(v_user,false,v_other) then raise exception 'Concurrent lease incorrectly granted'; end if;
 update public.solar_billing_accounts set lease_until=now()-interval '1 minute' where user_id=v_user and livemode=false;
 if not public.solar_billing_claim(v_user,false,v_other) then raise exception 'Expired lease was not released'; end if;
 if has_table_privilege('anon','public.solar_billing_accounts','select') or has_table_privilege('authenticated','public.solar_billing_accounts','update') then raise exception 'Client billing access granted'; end if;
 if has_function_privilege('anon','public.solar_billing_claim(uuid,boolean,uuid)','execute') then raise exception 'Client lease access granted'; end if;
end $$;
rollback;
