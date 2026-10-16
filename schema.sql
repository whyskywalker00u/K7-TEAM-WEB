-- Run in Supabase Dashboard -> SQL Editor.
create table if not exists public.k7_site_content (
  id integer primary key default 1 check (id = 1),
  content jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.k7_site_content enable row level security;
-- No browser/client access is granted. The Node server uses the service-role key privately.
revoke all on table public.k7_site_content from anon, authenticated;
insert into public.k7_site_content (id, content)
values (1, '{"version":1}'::jsonb)
on conflict (id) do nothing;

-- Create a public media bucket for player photos/news images/highlights.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('k7-media', 'k7-media', true, 20971520,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do update set public = true;
-- Uploads are performed only by the server using its service-role key.
