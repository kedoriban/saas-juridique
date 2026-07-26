-- ============================================================
-- Phase 4 : Intégration ChatGPT (OpenAI)
-- À appliquer via le SQL Editor Supabase.
-- Prérequis : fonction is_admin() (migration 001).
-- ============================================================

-- ── app_settings : configuration applicative (clé API OpenAI, modèle) ──────────
-- Secrets applicatifs. AUCUNE policy de lecture pour les utilisateurs :
-- la lecture ne se fait QUE côté serveur via la clé service-role (RLS bypass).
create table if not exists app_settings (
  key         text primary key,
  value       text,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table app_settings enable row level security;

-- Écriture + lecture réservées aux admins (via anon key). Le serveur, lui,
-- lit via service-role et n'est pas soumis à la RLS.
drop policy if exists "app_settings_admin" on app_settings;
create policy "app_settings_admin" on app_settings
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── arret_ai_suggestions : pré-remplissage IA par critère (vis-à-vis système) ──
create table if not exists arret_ai_suggestions (
  id              uuid primary key default gen_random_uuid(),
  arret_id        uuid not null references arrets(id) on delete cascade,
  criterion_id    text not null references criteria(id) on delete cascade,
  suggested_value text,
  confidence      real,
  model           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (arret_id, criterion_id)
);
create index if not exists ai_suggestions_arret on arret_ai_suggestions (arret_id);

alter table arret_ai_suggestions enable row level security;

drop policy if exists "ai_suggestions_read" on arret_ai_suggestions;
create policy "ai_suggestions_read" on arret_ai_suggestions
  for select to authenticated using (true);

drop policy if exists "ai_suggestions_write" on arret_ai_suggestions;
create policy "ai_suggestions_write" on arret_ai_suggestions
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'avocat')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'avocat')));

-- ── arret_chat_messages : chat par arrêt, conversation persistée ───────────────
create table if not exists arret_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  arret_id    uuid not null references arrets(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system')),
  content     text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_arret on arret_chat_messages (arret_id, created_at);

alter table arret_chat_messages enable row level security;

drop policy if exists "chat_read" on arret_chat_messages;
create policy "chat_read" on arret_chat_messages
  for select to authenticated using (true);

drop policy if exists "chat_write" on arret_chat_messages;
create policy "chat_write" on arret_chat_messages
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'avocat')))
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'avocat')));
