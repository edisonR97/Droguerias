import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyInventoryCount,
  approveInventoryCount,
  cancelTransfer,
  getInventoryCounts,
  getTransfers,
  receiveTransfer,
  shipTransfer,
} from './api';
export function InventoryOperationsPage() {
  const q = useQueryClient(),
    transfers = useQuery({ queryKey: ['transfers'], queryFn: getTransfers }),
    counts = useQuery({ queryKey: ['counts'], queryFn: getInventoryCounts });
  const refresh = () => {
    void q.invalidateQueries({ queryKey: ['transfers'] });
    void q.invalidateQueries({ queryKey: ['counts'] });
    void q.invalidateQueries({ queryKey: ['products'] });
    void q.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const ship = useMutation({ mutationFn: shipTransfer, onSuccess: refresh }),
    receive = useMutation({ mutationFn: receiveTransfer, onSuccess: refresh }),
    cancel = useMutation({ mutationFn: cancelTransfer, onSuccess: refresh }),
    approve = useMutation({ mutationFn: approveInventoryCount, onSuccess: refresh }),
    apply = useMutation({ mutationFn: applyInventoryCount, onSuccess: refresh });
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Operaciones de inventario</h2>
          <p>Transferencias entre sedes y conteos físicos auditados.</p>
        </div>
      </div>
      <div className="panel">
        <h3>Transferencias</h3>
        <div className="table-wrap embedded">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Ruta</th>
                <th>Lotes</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {transfers.data?.map((t) => (
                <tr key={t.id}>
                  <td>
                    <code>#{t.number}</code>
                  </td>
                  <td>
                    {t.originBranch.name} → {t.destinationBranch.name}
                  </td>
                  <td>
                    {t.items
                      .map(
                        (i) =>
                          `${i.product.commercialName} · ${i.sourceBatch.lotNumber} × ${Number(i.quantity)}`,
                      )
                      .join(', ')}
                  </td>
                  <td>{t.status}</td>
                  <td>
                    <div className="row-actions">
                      {t.status === 'DRAFT' && (
                        <button className="secondary" onClick={() => ship.mutate(t.id)}>
                          Despachar
                        </button>
                      )}
                      {t.status === 'IN_TRANSIT' && (
                        <button className="secondary" onClick={() => receive.mutate(t.id)}>
                          Recibir
                        </button>
                      )}
                      {['DRAFT', 'IN_TRANSIT'].includes(t.status) && (
                        <button
                          className="danger-button"
                          onClick={() => confirm('¿Cancelar transferencia?') && cancel.mutate(t.id)}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel operations-panel">
        <h3>Conteos físicos</h3>
        <div className="table-wrap embedded">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Sede</th>
                <th>Motivo</th>
                <th>Resultado por lote</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {counts.data?.map((c) => (
                <tr key={c.id}>
                  <td>
                    <code>#{c.number}</code>
                  </td>
                  <td>{c.branch.name}</td>
                  <td>{c.reason}</td>
                  <td>
                    {c.items
                      .map(
                        (i) =>
                          `${i.batch.product.commercialName} · ${i.batch.lotNumber}: ${Number(i.expectedQuantity)} → ${Number(i.countedQuantity)}`,
                      )
                      .join(', ')}
                  </td>
                  <td>{c.status}</td>
                  <td>
                    {c.status === 'SUBMITTED' ? (
                      <button className="secondary" onClick={() => approve.mutate(c.id)}>
                        Aprobar
                      </button>
                    ) : c.status === 'APPROVED' ? (
                      <button className="secondary" onClick={() => apply.mutate(c.id)}>
                        Aplicar
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
