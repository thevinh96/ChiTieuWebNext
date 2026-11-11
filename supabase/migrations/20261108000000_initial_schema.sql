create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  title text not null check (char_length(title) between 1 and 80),
  amount numeric(19, 0) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  transaction_date date not null default current_date,
  method text not null default 'Tiền mặt',
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc, created_at desc);

alter table public.categories enable row level security;
alter table public.transactions enable row level security;

grant usage on schema public to authenticated;
grant select on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

drop policy if exists "Signed-in users can view categories" on public.categories;
create policy "Signed-in users can view categories"
  on public.categories for select to authenticated using (true);

drop policy if exists "Users can view their own transactions" on public.transactions;
create policy "Users can view their own transactions"
  on public.transactions for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own transactions" on public.transactions;
create policy "Users can add their own transactions"
  on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can edit their own transactions" on public.transactions;
create policy "Users can edit their own transactions"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own transactions" on public.transactions;
create policy "Users can delete their own transactions"
  on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

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
