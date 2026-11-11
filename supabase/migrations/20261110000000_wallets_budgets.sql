insert into public.categories (name, icon, color) values
  ('Ăn uống', 'utensils', '#ef9b72'),
  ('Di chuyển', 'car', '#8b9bf5'),
  ('Mua sắm', 'shopping-bag', '#e88ca3'),
  ('Hóa đơn', 'receipt', '#64b7a7'),
  ('Giải trí', 'clapperboard', '#b49ae8'),
  ('Sức khỏe', 'heart-pulse', '#e87777'),
  ('Lương', 'briefcase-business', '#5da98b'),
  ('Khác', 'shapes', '#9da7a1')
on conflict (name) do update set icon = excluded.icon, color = excluded.color;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type text not null default 'cash' check (type in ('cash', 'bank', 'ewallet', 'savings')),
  opening_balance numeric(19, 0) not null default 0 check (opening_balance >= 0),
  color text not null default '#4d8664',
  created_at timestamptz not null default now()
);

create index if not exists wallets_user_idx on public.wallets(user_id, created_at);

insert into public.wallets (user_id, name, type)
select users.id, 'Ví chính', 'cash'
from auth.users as users
where not exists (select 1 from public.wallets as wallet where wallet.user_id = users.id);

create or replace function public.create_default_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id, name, type)
  values (new.id, 'Ví chính', 'cash');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_default_wallet on auth.users;
create trigger on_auth_user_created_default_wallet
  after insert on auth.users
  for each row execute function public.create_default_wallet();

alter table public.transactions add column if not exists wallet_id uuid references public.wallets(id) on delete restrict;

update public.transactions as transaction
set wallet_id = wallet.id
from public.wallets as wallet
where transaction.user_id = wallet.user_id and transaction.wallet_id is null;

alter table public.transactions alter column wallet_id set not null;
create index if not exists transactions_wallet_idx on public.transactions(wallet_id, transaction_date desc);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount numeric(19, 0) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create index if not exists budgets_user_month_idx on public.budgets(user_id, month);

alter table public.wallets enable row level security;
alter table public.budgets enable row level security;

grant select, insert, update, delete on public.wallets to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
grant update on public.transactions to authenticated;

drop policy if exists "Users can manage their own wallets" on public.wallets;
create policy "Users can manage their own wallets" on public.wallets
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own budgets" on public.budgets;
create policy "Users can manage their own budgets" on public.budgets
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Transactions must use own wallet" on public.transactions;
drop policy if exists "Users can add their own transactions" on public.transactions;
drop policy if exists "Users can edit their own transactions" on public.transactions;
create policy "Transactions must use own wallet" on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.wallets where wallets.id = wallet_id and wallets.user_id = (select auth.uid()))
  );
