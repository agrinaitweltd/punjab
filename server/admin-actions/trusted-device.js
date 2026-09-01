// System-Developer-only trusted-device lock (items 6-16): re-verifies an
// already-authenticated Supabase session on a saved device via WebAuthn
// (Face ID / platform authenticator) or a bcrypt-hashed 6-digit passcode.
// This NEVER performs, replaces, or bypasses the real email+password
// Supabase login - see requireSystemDeveloper() below, called on every op,
// which requires a valid Supabase bearer token first. No password,
// passcode plaintext, or biometric template is ever stored or logged.
import bcrypt from 'bcryptjs'
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { guardApi, safeError } from '../security.js'
import { requireSystemDeveloper } from '../sensitive-actions.js'

const CHALLENGE_TTL_MS = 2 * 60_000
const RP_NAME = 'Punjab Exotic Foods'
// Escalating lockout (item 11): 4 fails -> 1 min, then 10 min, then grows -
// enforced here server-side, not just in the browser.
const LOCK_DURATIONS_SEC = [60, 600, 1800, 3600, 21600, 86_400]
const FAILS_PER_TIER = 4

function rpContext(req) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim().toLowerCase()
  const rpID = host.split(':')[0]
  return { rpID, origin: `https://${host}` }
}

async function loadDevice(admin, deviceId, staffId) {
  const { data } = await admin.from('trusted_devices').select('*').eq('id', deviceId).eq('admin_staff_id', staffId).is('revoked_at', null).maybeSingle()
  return data
}

export default async function handler(req, res) {
  if (!guardApi(req, res, { methods: ['GET', 'POST'], maxBytes: 20_000, limit: 40, windowMs: 60_000 })) return
  const auth = await requireSystemDeveloper(req, res)
  if (!auth) return
  const { staff, admin } = auth

  try {
    if (req.method === 'GET') {
      const { data } = await admin.from('trusted_devices').select('id,device_label,webauthn_credential_id,passcode_hash,created_at,last_used_at').eq('admin_staff_id', staff.id).is('revoked_at', null).order('created_at', { ascending: false })
      return res.status(200).json({
        ok: true,
        devices: (data || []).map(d => ({ id: d.id, label: d.device_label, hasWebAuthn: Boolean(d.webauthn_credential_id), hasPasscode: Boolean(d.passcode_hash), createdAt: d.created_at, lastUsedAt: d.last_used_at })),
      })
    }

    const op = String(req.body?.op || '')
    const deviceId = String(req.body?.deviceId || '')
    if (!deviceId || !/^[a-zA-Z0-9_-]{8,64}$/.test(deviceId)) return res.status(400).json({ error: 'Invalid device id.' })
    const { rpID, origin } = rpContext(req)

    if (op === 'save-device') {
      // Registers a NEW trusted device row for THIS system developer only -
      // IDOR-safe because admin_staff_id always comes from the verified
      // session's own staff row above, never from client input (item 16).
      const label = String(req.body?.label || 'Mobile device').slice(0, 80)
      const { error } = await admin.from('trusted_devices').upsert({ id: deviceId, admin_staff_id: staff.id, device_label: label, revoked_at: null }, { onConflict: 'id' })
      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    const device = await loadDevice(admin, deviceId, staff.id)
    if (!device) return res.status(404).json({ error: 'Trusted device not found.' })

    if (op === 'revoke') {
      await admin.from('trusted_devices').update({ revoked_at: new Date().toISOString() }).eq('id', deviceId)
      return res.status(200).json({ ok: true })
    }

    if (op === 'webauthn-register-options') {
      const options = await generateRegistrationOptions({
        rpName: RP_NAME, rpID, userName: staff.email || staff.name, userDisplayName: staff.name,
        attestationType: 'none',
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
      })
      await admin.from('trusted_devices').update({ pending_challenge: options.challenge, pending_challenge_expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() }).eq('id', deviceId)
      return res.status(200).json({ ok: true, options })
    }

    if (op === 'webauthn-register-verify') {
      if (!device.pending_challenge || !device.pending_challenge_expires_at || new Date(device.pending_challenge_expires_at) < new Date()) {
        return res.status(400).json({ error: 'This registration attempt expired. Please try again.' })
      }
      let verification
      try {
        verification = await verifyRegistrationResponse({ response: req.body?.response, expectedChallenge: device.pending_challenge, expectedOrigin: origin, expectedRPID: rpID })
      } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Verification failed.' })
      }
      if (!verification.verified || !verification.registrationInfo) return res.status(400).json({ error: 'Face ID setup could not be verified.' })
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
      await admin.from('trusted_devices').update({
        webauthn_credential_id: credential.id, webauthn_public_key: isoBase64URL.fromBuffer(credential.publicKey),
        webauthn_counter: credential.counter, webauthn_device_type: credentialDeviceType, webauthn_backed_up: credentialBackedUp,
        webauthn_transports: (credential.transports || []).join(','), pending_challenge: null, pending_challenge_expires_at: null,
      }).eq('id', deviceId)
      return res.status(200).json({ ok: true })
    }

    if (op === 'webauthn-auth-options') {
      if (!device.webauthn_credential_id) return res.status(400).json({ error: 'Face ID is not set up on this device.' })
      const options = await generateAuthenticationOptions({
        rpID, userVerification: 'required',
        allowCredentials: [{ id: device.webauthn_credential_id, transports: device.webauthn_transports ? device.webauthn_transports.split(',') : undefined }],
      })
      await admin.from('trusted_devices').update({ pending_challenge: options.challenge, pending_challenge_expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() }).eq('id', deviceId)
      return res.status(200).json({ ok: true, options })
    }

    if (op === 'webauthn-auth-verify') {
      if (!device.webauthn_credential_id) return res.status(400).json({ error: 'Face ID is not set up on this device.' })
      if (!device.pending_challenge || !device.pending_challenge_expires_at || new Date(device.pending_challenge_expires_at) < new Date()) {
        return res.status(400).json({ error: 'This verification attempt expired. Please try again.' })
      }
      let verification
      try {
        verification = await verifyAuthenticationResponse({
          response: req.body?.response, expectedChallenge: device.pending_challenge, expectedOrigin: origin, expectedRPID: rpID,
          credential: { id: device.webauthn_credential_id, publicKey: isoBase64URL.toBuffer(device.webauthn_public_key), counter: device.webauthn_counter },
        })
      } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Verification failed.' })
      }
      if (!verification.verified) return res.status(401).json({ error: 'Face ID verification failed.' })
      await admin.from('trusted_devices').update({ webauthn_counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString(), pending_challenge: null, pending_challenge_expires_at: null }).eq('id', deviceId)
      return res.status(200).json({ ok: true })
    }

    if (op === 'passcode-set') {
      const passcode = String(req.body?.passcode || '')
      if (!/^\d{6}$/.test(passcode)) return res.status(400).json({ error: 'The passcode must be exactly 6 digits.' })
      const hash = await bcrypt.hash(passcode, 10)
      await admin.from('trusted_devices').update({ passcode_hash: hash, passcode_fail_count: 0, passcode_locked_until: null, passcode_lock_tier: 0 }).eq('id', deviceId)
      return res.status(200).json({ ok: true })
    }

    if (op === 'passcode-verify') {
      // Wrong-passcode/locked-out are normal, expected outcomes here (not
      // server errors) - always 200 with an { ok:false, ... } body so the
      // client's shared api() helper (which throws away the body on a
      // non-2xx and keeps only a message string) doesn't discard the
      // structured lockedUntil/attemptsRemaining fields the UI needs.
      if (!device.passcode_hash) return res.status(200).json({ ok: false, error: 'No passcode is set up on this device.' })
      if (device.passcode_locked_until && new Date(device.passcode_locked_until) > new Date()) {
        return res.status(200).json({ ok: false, locked: true, error: 'Too many attempts. Try again later.', lockedUntil: device.passcode_locked_until })
      }
      const passcode = String(req.body?.passcode || '')
      const match = /^\d{6}$/.test(passcode) && await bcrypt.compare(passcode, device.passcode_hash)
      if (match) {
        await admin.from('trusted_devices').update({ passcode_fail_count: 0, passcode_locked_until: null, passcode_lock_tier: 0, last_used_at: new Date().toISOString() }).eq('id', deviceId)
        return res.status(200).json({ ok: true })
      }
      const failCount = device.passcode_fail_count + 1
      if (failCount >= FAILS_PER_TIER) {
        const tier = device.passcode_lock_tier
        const lockSeconds = LOCK_DURATIONS_SEC[Math.min(tier, LOCK_DURATIONS_SEC.length - 1)]
        const lockedUntil = new Date(Date.now() + lockSeconds * 1000).toISOString()
        await admin.from('trusted_devices').update({ passcode_fail_count: 0, passcode_locked_until: lockedUntil, passcode_lock_tier: tier + 1 }).eq('id', deviceId)
        return res.status(200).json({ ok: false, locked: true, error: 'Too many attempts. Locked temporarily.', lockedUntil })
      }
      await admin.from('trusted_devices').update({ passcode_fail_count: failCount }).eq('id', deviceId)
      return res.status(200).json({ ok: false, error: 'Incorrect passcode.', attemptsRemaining: FAILS_PER_TIER - failCount })
    }

    return res.status(400).json({ error: 'Unknown operation.' })
  } catch (error) {
    console.error('trusted-device action failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(502).json({ error: safeError })
  }
}
