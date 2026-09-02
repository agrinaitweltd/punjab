-- 1) Close a live privilege-escalation hole: the existing admin_staff RLS
-- policy ("admin_staff_admin_only", cmd ALL, using is_admin() OR
-- auth_user_id = auth.uid(), with_check is_admin()) let ANY active
-- admin_staff row - any role, zero permissions - write directly to their
-- own or any other admin_staff row via the client SDK, since is_admin()
-- only checks active=true with no role/permission check. A raw
-- supabase.from('admin_staff').update({ is_super_admin: true }) call from
-- any logged-in admin's browser session would have succeeded. All real
-- admin_staff writes already go through server-side actions
-- (invite-admin.js, manage-admin.js, reset-admin-credentials.js) using the
-- service role, which bypasses RLS entirely - client write access was
-- never actually needed. Read access is preserved unchanged.
drop policy if exists admin_staff_admin_only on public.admin_staff;
create policy admin_staff_select on public.admin_staff for select using (is_admin() OR auth_user_id = auth.uid());
-- Deliberately no insert/update/delete policy for the authenticated role -
-- only the service role (which bypasses RLS) may write to this table.

-- 2) "Owner" already functions as the full-access business role sitting
-- below System Developer (is_super_admin bypasses every permission check -
-- see src/lib/permissions.ts can()) - rename it to "Super Admin" to match
-- what it actually is, and make sure both existing Owner accounts
-- (including Malik Koasar, who was labelled Owner but missing the
-- is_super_admin flag) actually carry that flag.
update public.admin_staff set role = 'Super Admin', is_super_admin = true where role = 'Owner';
