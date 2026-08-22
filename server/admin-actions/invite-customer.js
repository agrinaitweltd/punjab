import { guardApi, requireUser, safeError } from '../security.js'
import { globalTestMode, serviceClient, simulatedResult } from '../runtime-mode.js'
import { brandedEmail, sendTransactionalEmail } from '../email-system.js'

const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export default async function handler(req, res) {
  if (!guardApi(req, res, { maxBytes: 8_192, limit: 12, windowMs: 15 * 60_000 })) return
  const user = await requireUser(req, res, { adminOnly: true })
  if (!user) return
  const customerId = String(req.body?.customerId || '').trim()
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!customerId || !validEmail(email)) return res.status(400).json({ error: 'Enter a valid customer and email address.' })

  const admin = serviceClient()
  let createdAuthUserId = null
  let invitationId = null
  try {
    if (await globalTestMode(admin)) return res.status(200).json(simulatedResult('Customer invitation'))
    const customerResult = await admin.from('customers').select('id,company_name,email,auth_user_id').eq('id', customerId).maybeSingle()
    if (customerResult.error) throw customerResult.error
    if (!customerResult.data) return res.status(404).json({ error: 'Customer account was not found.' })
    const customer = customerResult.data
    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim()
    const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim()
    const redirectTo = `${protocol}://${host}/?setup=password`
    let actionLink = ''
    let authUserId = customer.auth_user_id

    if (authUserId) {
      const authUser = await admin.auth.admin.getUserById(authUserId)
      if (authUser.error || !authUser.data.user?.email) throw authUser.error || new Error('Linked customer login was not found')
      if (authUser.data.user.email.toLowerCase() !== email) {
        const changed = await admin.auth.admin.updateUserById(authUserId, { email, email_confirm: true })
        if (changed.error) throw changed.error
      }
      const recovery = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } })
      if (recovery.error || !recovery.data?.properties?.action_link) throw recovery.error || new Error('Customer setup link was not generated')
      actionLink = recovery.data.properties.action_link
    } else {
      const generated = await admin.auth.admin.generateLink({ type: 'invite', email, options: { data: { name: customer.company_name, portal_role: 'customer' }, redirectTo } })
      if (generated.error || !generated.data?.properties?.action_link || !generated.data.user) throw generated.error || new Error('Customer invitation link was not generated')
      createdAuthUserId = generated.data.user.id
      authUserId = generated.data.user.id
      actionLink = generated.data.properties.action_link
      const metadata = await admin.auth.admin.updateUserById(authUserId, { app_metadata: { role: 'customer' } })
      if (metadata.error) throw metadata.error
      const linked = await admin.from('customers').update({ auth_user_id: authUserId, email }).eq('id', customerId)
      if (linked.error) throw linked.error
    }

    const invitation = await admin.from('portal_invitations').insert({ customer_id: customerId, email, status: 'Sent', sent_at: new Date().toISOString(), created_by: user.email || user.id }).select('id').single()
    if (invitation.error) throw invitation.error
    invitationId = invitation.data.id
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) throw new Error('Invitation email provider is not configured')
    const message = await sendTransactionalEmail({ apiKey: resendKey, category: 'signup', to: email, subject: 'Set up your Punjab Exotic Foods customer account', admin, customerId, communicationType: 'customer_invitation', createdBy: user.email || user.id,
      html: brandedEmail({ heading: 'Welcome to your customer portal', intro: `${customer.company_name || 'Your business'} has been invited to Punjab Exotic Foods.`, contentHtml: `<p style="margin:0;text-align:center;color:#59655d">Use the secure one-time link below to choose your password and activate the account. Punjab Exotic Foods will never email you a password.</p>`, cta: { label: 'Activate Account', url: actionLink }, logoUrl: `${protocol}://${host}/logo.png` }),
    })
    if (!message.ok) throw new Error(message.error || 'Invitation delivery failed')
    return res.status(200).json({ ok: true })
  } catch (error) {
    if (invitationId) await admin.from('portal_invitations').update({ status: 'Failed', error: 'Invitation delivery failed' }).eq('id', invitationId)
    if (createdAuthUserId) {
      await admin.from('customers').update({ auth_user_id: null }).eq('id', customerId)
      await admin.auth.admin.deleteUser(createdAuthUserId)
    }
    console.error('invite-customer failed', error instanceof Error ? error.message : 'Unknown error')
    return res.status(500).json({ error: safeError })
  }
}
