-- Lafl TMS · Migration 003 · money: planned charges, actual expenses, advance ledger, settlements, customer billing
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.

create table trip_charges (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  charge_type text not null, -- freight, diesel, driver_allowance, toll, fastag, loading, unloading, misc, detention...
  planned_amount numeric(12,2) not null default 0, -- from master
  approved_amount numeric(12,2) not null default 0, -- what supervisor approved
  source charge_source not null default 'master',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_charges_trip on trip_charges (trip_id);

create table trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  expense_type text not null,
  amount numeric(12,2) not null,
  incurred_at timestamptz not null default now(),
  receipt_url text,
  remarks text,
  added_by uuid references profiles(id),
  approved boolean not null default false,
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_expenses_trip on trip_expenses (trip_id);

create table advances (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  driver_id uuid not null references drivers(id),
  amount numeric(12,2) not null check (amount > 0),
  mode pay_mode not null default 'cash',
  ref_no text,
  paid_at timestamptz not null default now(),
  paid_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_advances_trip on advances (trip_id);

create table driver_settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id),
  driver_id uuid not null references drivers(id),
  gross_amount numeric(12,2) not null default 0,
  advances_deducted numeric(12,2) not null default 0,
  bonus numeric(12,2) not null default 0,
  penalty numeric(12,2) not null default 0,
  penalty_reason text,
  net_payable numeric(12,2) not null default 0,
  status settlement_row_status not null default 'pending',
  mode pay_mode,
  ref_no text,
  paid_at timestamptz,
  paid_by uuid references profiles(id),
  marketpe_payment_id text unique, -- reconcile with payment/list clientPaymentId
  created_at timestamptz not null default now(),
  unique (trip_id, driver_id)
);
create index idx_settlements_status on driver_settlements (status);

create table customer_invoices (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id),
  customer_id uuid not null references customers(id),
  invoice_no text unique,
  freight_amount numeric(14,2) not null default 0,
  other_charges numeric(14,2) not null default 0, -- detention etc.
  gst_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  status billing_track_status not null default 'unbilled',
  due_date date,
  received_amount numeric(14,2) not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_invoices_trip on customer_invoices (trip_id);
