import { Card } from '../../components/ui/Card'

export function SimpleModulePage({ title, text }: { title: string; text: string }) {
  return (
    <Card title={title}>
      <p>{text}</p>
    </Card>
  )
}
