import assert from 'node:assert/strict'
import login from '../api/login.js'

const project = process.env.SUPABASE_PROJECT_REF
const pat = process.env.SUPABASE_ACCESS_TOKEN
const password = process.env.DEVELOPER_TEST_PASSWORD
if (!project || !pat || !password) throw new Error('Missing live-login test environment')

const management = `https://api.supabase.com/v1/projects/${project}`
const keysResponse = await fetch(`${management}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${pat}` } })
assert.equal(keysResponse.ok, true)
const keys = await keysResponse.json()
const keyValue = name => {
  const entry = keys.find(key => key.name === name)
  return entry?.api_key || entry?.key
}
process.env.VITE_SUPABASE_URL = `https://${project}.supabase.co`
process.env.VITE_SUPABASE_ANON_KEY = keyValue('anon')
process.env.SUPABASE_SERVICE_ROLE_KEY = keyValue('service_role')
process.env.NODE_ENV = 'test'

const invoke = body => new Promise(resolve => {
  const response = {
    statusCode: 200, headers: {}, payload: null,
    status(code) { this.statusCode = code; return this },
    setHeader(key, value) { this.headers[key] = value },
    json(payload) { this.payload = payload; resolve(this) },
  }
  login({ method: 'POST', url: '/api/login', headers: {}, body }, response)
})

const valid = await invoke({ role: 'admin', identifier: 'info@kavotech.uk', password })
assert.equal(valid.statusCode, 200)
assert.ok(valid.payload.accessToken)
assert.ok(valid.payload.refreshToken)

const invalid = await invoke({ role: 'admin', identifier: 'info@kavotech.uk', password: `${password}-invalid` })
assert.equal(invalid.statusCode, 401)

console.log('Live login tests passed')
