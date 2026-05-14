
create or replace function public.claim_pairing_code(_code text, _device_name text)
returns public.paired_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.paired_devices;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into rec from public.paired_devices where pairing_code = _code;

  if not found then
    raise exception 'PAIR_CODE_INVALID';
  end if;

  if rec.paired_at is not null then
    raise exception 'PAIR_CODE_ALREADY_USED';
  end if;

  if rec.user_id <> auth.uid() then
    raise exception 'PAIR_CODE_WRONG_ACCOUNT';
  end if;

  update public.paired_devices
     set paired_at = now(),
         last_used_at = now(),
         device_name = coalesce(nullif(_device_name, ''), device_name)
   where id = rec.id
  returning * into rec;

  return rec;
end;
$$;

grant execute on function public.claim_pairing_code(text, text) to authenticated;
