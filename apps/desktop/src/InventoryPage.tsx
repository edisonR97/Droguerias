import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes } from 'lucide-react';
import { getExpiryAlerts } from './api';

export function InventoryPage() {
  const alerts = useQuery({ queryKey: ['expiry-alerts'], queryFn: getExpiryAlerts });
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Inventario y vencimientos</h2>
          <p>Priorización FEFO para disminuir pérdidas y proteger al paciente.</p>
        </div>
        <span className="result-count">{alerts.data?.length ?? 0} lotes requieren revisión</span>
      </div>
      {alerts.isLoading && <div className="panel">Analizando lotes…</div>}
      {alerts.isError && (
        <div className="error">No se pudo cargar el inventario: {alerts.error.message}</div>
      )}
      {alerts.data && alerts.data.length === 0 && (
        <div className="panel empty-state">
          <Boxes />
          <strong>Sin lotes próximos a vencer</strong>
          <span>Los lotes dentro del horizonte de 180 días aparecerán aquí.</span>
        </div>
      )}
      {alerts.data && alerts.data.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Prioridad</th>
                <th>Producto</th>
                <th>Lote</th>
                <th>Sede / ubicación</th>
                <th>Vence</th>
                <th>Cantidad</th>
                <th>Valor en riesgo</th>
              </tr>
            </thead>
            <tbody>
              {alerts.data.map((batch) => (
                <tr key={batch.id}>
                  <td>
                    <span
                      className={`expiry-pill ${batch.daysRemaining < 0 ? 'expired' : batch.daysRemaining <= 30 ? 'urgent' : 'notice'}`}
                    >
                      <AlertTriangle />
                      {batch.daysRemaining < 0 ? 'Vencido' : `${batch.daysRemaining} días`}
                    </span>
                  </td>
                  <td>
                    <strong>{batch.product.commercialName}</strong>
                    <small>{batch.product.internalCode}</small>
                  </td>
                  <td>
                    <code>{batch.lotNumber}</code>
                  </td>
                  <td>
                    {batch.branch.name}
                    <small>{batch.location?.name ?? 'Sin ubicación asignada'}</small>
                  </td>
                  <td>{new Intl.DateTimeFormat('es-CO').format(new Date(batch.expiresAt))}</td>
                  <td>{Number(batch.quantity).toLocaleString('es-CO')}</td>
                  <td>{money(batch.inventoryValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function money(value: string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
