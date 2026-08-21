import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { getFinanceSettings, saveFinanceSettings } from '../../services/financeSettingsService'

export function SettingsPage() {
  const [companyName, setCompanyName] = useState('Punjab Exotic Foods Ltd')
  const [supportEmail, setSupportEmail] = useState('info@punjabexoticfoods.com')
  const [orderCutoff, setOrderCutoff] = useState('17:00')
  const [saved, setSaved] = useState(false)
  const [paymentDays,setPaymentDays]=useState('21')
  const [reminderDays,setReminderDays]=useState('7')
  useEffect(()=>{getFinanceSettings().then(x=>{setPaymentDays(String(x.defaultPaymentTermsDays));setReminderDays(String(x.reminderDaysBeforeDue))})},[])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await saveFinanceSettings({defaultPaymentTermsDays:Math.max(0,Number(paymentDays)||0),reminderDaysBeforeDue:Math.max(0,Number(reminderDays)||0)})
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="stack"><Card title="Portal Settings">
      <form className="form-grid" onSubmit={submit}>
        <Input label="Company Name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        <Input label="Support Email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
        <Input label="Order Cut-Off Time" type="time" value={orderCutoff} onChange={(event) => setOrderCutoff(event.target.value)} />

        <div className="wide actions-row">
          <Button type="submit">Save Settings</Button>
          {saved ? <span>Saved</span> : null}
        </div>
      </form>
    </Card><Card title="Invoice & Payment Settings"><div className="form-grid"><Input label="Default Payment Terms (days)" type="number" min="0" value={paymentDays} onChange={e=>setPaymentDays(e.target.value)}/><Input label="Reminder Days Before Due Date" type="number" min="0" value={reminderDays} onChange={e=>setReminderDays(e.target.value)}/></div><p style={{fontSize:12,color:'#667085',marginTop:10}}>These shared defaults are used for invoice due dates and scheduled reminder processing.</p><div className="actions-row" style={{marginTop:12}}><Button onClick={async()=>{await saveFinanceSettings({defaultPaymentTermsDays:Math.max(0,Number(paymentDays)||0),reminderDaysBeforeDue:Math.max(0,Number(reminderDays)||0)});setSaved(true);setTimeout(()=>setSaved(false),1800)}}>Save Invoice Settings</Button>{saved&&<span>Saved</span>}</div></Card></div>
  )
}
