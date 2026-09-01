-- System-Developer-only trusted-device lock (items 6-16). This is NOT a
-- login mechanism - it re-verifies an already-authenticated Supabase
-- session on a device the System Developer explicitly saved, via either a
-- WebAuthn platform authenticator (Face ID etc.) or a bcrypt-hashed 6-digit
-- passcode. No password, passcode plaintext, or biometric data is ever
-- stored here. RLS is enabled with zero policies - every access to this
-- table goes through server/admin-actions/trusted-device.js under the
-- service-role client, gated by requireSystemDeveloper() on every call, so
-- there is no direct client path to read or write it at all (matches
-- health_check_runs/email_import_cursor's existing service-only pattern).
create table if not exists public.trusted_devices (
  id text primary key,
  admin_staff_id text not null references public.admin_staff(id) on delete cascade,
  device_label text,

  -- WebAuthn platform authenticator credential (Face ID / Touch ID / Windows Hello).
  webauthn_credential_id text unique,
  webauthn_public_key text,
  webauthn_counter bigint not null default 0,
  webauthn_device_type text,
  webauthn_backed_up boolean not null default false,
  webauthn_transports text,

  -- 6-digit passcode fallback - bcrypt hash only, never plaintext.
  passcode_hash text,
  passcode_fail_count int not null default 0,
  passcode_locked_until timestamptz,
  -- Escalating lockout tier (item 11): 0=none seen yet, then 1,2,3... each
  -- new threshold crossed after a cooldown expires locks for longer.
  passcode_lock_tier int not null default 0,

  -- Short-lived WebAuthn ceremony challenge (registration or assertion) -
  -- overwritten on every new attempt, expires quickly either way.
  pending_challenge text,
  pending_challenge_expires_at timestamptz,

  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.trusted_devices enable row level security;
create index if not exists trusted_devices_admin_staff_id_idx on public.trusted_devices (admin_staff_id) where revoked_at is null;
