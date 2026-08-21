-- Secure generated-document storage for the Supabase Auth phase.
-- Do not make this bucket public. The application should switch from the
-- activity_log compatibility store only after admin users receive Auth JWTs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-documents', 'customer-documents', false, 10485760, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false;

alter table generated_documents add column if not exists mime_type text not null default 'application/pdf';
alter table generated_documents add column if not exists file_size bigint;
alter table generated_documents add column if not exists storage_bucket text not null default 'customer-documents';
alter table generated_documents add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists generated_documents_storage_path_idx on generated_documents(storage_bucket, file_path);

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'customer_documents_admin_read') then
    create policy customer_documents_admin_read on storage.objects for select
      using (bucket_id = 'customer-documents' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'customer_documents_admin_write') then
    create policy customer_documents_admin_write on storage.objects for insert
      with check (bucket_id = 'customer-documents' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'customer_documents_admin_update') then
    create policy customer_documents_admin_update on storage.objects for update
      using (bucket_id = 'customer-documents' and public.is_admin())
      with check (bucket_id = 'customer-documents' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'customer_documents_admin_delete') then
    create policy customer_documents_admin_delete on storage.objects for delete
      using (bucket_id = 'customer-documents' and public.is_admin());
  end if;
end $$;
