-- The System-Developer trusted-device/Face ID/passcode lock was removed
-- per explicit request - table was empty (0 rows, never used in
-- production) so this is a clean drop, no data lost.
drop table if exists public.trusted_devices;
