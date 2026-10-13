-- ════════════════════════════════════════════════════════════════
--  MTNH · THE PAYEE BOOK AND PROOF OF PAYMENT
--
--  Run this once in the Supabase SQL Editor. Safe to run twice.
--  Nothing here deletes or rewrites anything you already have.
-- ════════════════════════════════════════════════════════════════


-- 1 ── THE PAYEE BOOK ────────────────────────────────────────────
--
-- A QR code belongs to a person, not to a payment. Anil Kumar Patel's
-- QR is the same QR next month and the month after. Today it gets
-- re-uploaded every single time a payment is raised, and anyone who
-- wants it has to scroll back through chat to find it.
--
-- Saved once here, it is picked from a list for ever after.

create table if not exists payees (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  upi_id        text,
  phone         text,
  qr_url        text,
  vendor        text,
  note          text,
  active        boolean not null default true,
  times_paid    int not null default 0,
  last_paid_at  timestamptz,
  created_by    text,
  created_at    timestamptz not null default now()
);

-- One person, one entry. Two "Anil Kumar Patel"s carrying different QR
-- codes is how the wrong man gets paid.
create unique index if not exists payees_name_uniq
  on payees (lower(btrim(name)));

alter table payees disable row level security;


-- 2 ── PROOF, ON THE PAYMENT ITSELF ──────────────────────────────
--
-- The screenshot was already being stored in receipt_url, but nothing
-- was read off it. A picture of a receipt you cannot search is not a
-- record — you cannot tick it off against the bank statement, and you
-- cannot tell that the same screenshot was sent in twice.
--
-- utr_ref is the transaction / UTR number printed on the PhonePe or
-- GPay success screen.

alter table room_payments add column if not exists payee_id  uuid references payees(id);
alter table room_payments add column if not exists utr_ref   text;
alter table room_payments add column if not exists proof_by  text;
alter table room_payments add column if not exists proof_at  timestamptz;


-- 3 ── ONE REFERENCE NUMBER, ONE PAYMENT ─────────────────────────
--
-- 1768 1585 6011, 176815856011 and "UTR 176815856011" are the same
-- number typed three ways, so the key strips everything that isn't a
-- letter or a digit before comparing. Written by the database rather
-- than the browser, so the two can never drift apart.

alter table room_payments add column if not exists utr_key text
  generated always as (
    nullif(upper(regexp_replace(coalesce(utr_ref, ''), '[^A-Za-z0-9]', '', 'g')), '')
  ) stored;

-- The bank's UTR is unique. If one turns up twice here, the same
-- screenshot has been submitted twice — which is the single thing a
-- proof-of-payment record exists to catch.
create unique index if not exists room_payments_utr_uniq
  on room_payments (utr_key)
  where utr_key is not null;


-- 4 ── THE BOOK SORTS ITSELF ─────────────────────────────────────
--
-- Paying someone bumps their count, so the people you actually pay
-- rise to the top of the dropdown and stay there. Nobody maintains it.

create or replace function payee_paid() returns trigger
language plpgsql as $fn$
begin
  if new.payee_id is not null
     and new.status = 'paid'
     and old.status is distinct from 'paid' then
    update payees
       set times_paid   = times_paid + 1,
           last_paid_at = coalesce(new.paid_at, now())
     where id = new.payee_id;
  end if;
  return new;
end $fn$;

drop trigger if exists trg_payee_paid on room_payments;
create trigger trg_payee_paid after update on room_payments
for each row execute function payee_paid();


-- 5 ── SEED THE BOOK FROM WHAT HAS ALREADY BEEN PAID ─────────────
--
-- Every name and UPI id ever typed into a payment request becomes an
-- entry, with the most recent QR attached. So the list is not empty on
-- the first day — the people you have been paying are already in it.

insert into payees (name, upi_id, qr_url, vendor, created_by, times_paid, last_paid_at)
select
  min(btrim(p.pay_to_name)),
  (array_agg(p.pay_to_upi order by p.requested_at desc)
     filter (where p.pay_to_upi is not null))[1],
  (array_agg(p.qr_url      order by p.requested_at desc)
     filter (where p.qr_url      is not null))[1],
  (array_agg(p.vendor      order by p.requested_at desc)
     filter (where p.vendor      is not null))[1],
  'imported',
  count(*) filter (where p.status = 'paid'),
  max(p.paid_at) filter (where p.status = 'paid')
from room_payments p
where p.pay_to_name is not null
  and btrim(p.pay_to_name) <> ''
group by lower(btrim(p.pay_to_name))
on conflict do nothing;

-- Point the old payments at their new book entry, so history reads the
-- same way as anything raised from today on.
update room_payments p
   set payee_id = e.id
  from payees e
 where p.payee_id is null
   and p.pay_to_name is not null
   and lower(btrim(p.pay_to_name)) = lower(btrim(e.name));


-- 6 ── WHAT YOU HAVE ─────────────────────────────────────────────

select
  (select count(*) from payees)                              as payees,
  (select count(*) from payees where qr_url is not null)     as payees_with_qr,
  (select count(*) from room_payments)                       as payments,
  (select count(*) from room_payments where status = 'paid') as paid,
  (select count(*) from room_payments
     where status = 'paid'
       and utr_key is null
       and receipt_url is null)                              as paid_without_proof;
