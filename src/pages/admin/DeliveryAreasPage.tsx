import type { DeliveryArea } from '../../types'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/ui/Table'

export function DeliveryAreasPage({ deliveryAreas }: { deliveryAreas: DeliveryArea[] }) {
  return (
    <div className="stack">
      <Card title="Delivery Area Pricing">
        <DataTable columns={['Area', 'Charge Per Pallet']}>
          {deliveryAreas.map((area) => (
            <tr key={area.id}>
              <td>{area.name}</td>
              <td>£{area.chargePerPallet.toFixed(2)}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  )
}
