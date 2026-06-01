-- Organisations (cabinets d'avocats)
create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profils utilisateurs liés à auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'lecteur' check (role in ('admin', 'avocat', 'lecteur')),
  organisation_id uuid references organisations(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Création automatique du profil à l'inscription
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'lecteur');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Fonction helper pour éviter la récursivité infinie dans les policies RLS.
-- security definer = s'exécute avec les droits du créateur, contourne RLS.
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- RLS
alter table organisations enable row level security;
alter table profiles enable row level security;

-- Profils : lecture de son propre profil
create policy "Profil : lecture propre" on profiles
  for select using (auth.uid() = id);

-- Profils : mise à jour de son propre profil (full_name uniquement en pratique)
create policy "Profil : mise à jour propre" on profiles
  for update using (auth.uid() = id);

-- Admin : lecture de tous les profils (via is_admin() pour éviter la récursion)
create policy "Admin : lecture profils" on profiles
  for select using (is_admin());

-- Admin : toutes opérations sur les profils
create policy "Admin : écriture profils" on profiles
  for all using (is_admin());

-- Organisations : lecture pour les membres (via leur profil)
create policy "Membre : lecture organisation propre" on organisations
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organisation_id = organisations.id
    )
  );

-- Admin : toutes opérations sur les organisations
create policy "Admin : gestion organisations" on organisations
  for all using (is_admin());
