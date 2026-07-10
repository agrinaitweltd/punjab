import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'

export function SettingsPage() {
  const [companyName, setCompanyName] = useState('Punjab Exotic Foods Ltd')
  const [supportEmail, setSupportEmail] = useState('support@punjabfoods.co.uk')
  const [orderCutoff, setOrderCutoff] = useState('17:00')
  const [saved, setSaved] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <Card title="Portal Settings">
      <form className="form-grid" onSubmit={submit}>
        <Input label="Company Name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        <Input label="Support Email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
        <Input label="Order Cut-Off Time" type="time" value={orderCutoff} onChange={(event) => setOrderCutoff(event.target.value)} />

        <div className="wide actions-row">
          <Button type="submit">Save Settings</Button>
          {saved ? <span>Saved</span> : null}
        </div>
      </form>
    </Card>
  )
}
