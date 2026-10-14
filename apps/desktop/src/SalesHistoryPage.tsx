import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { createSaleReturn, getCashHistory, getSalesHistory, voidSale } from './api';
export function SalesHistoryPage() {
  const client = useQueryClient(),
    [search, setSearch] = useState(''),
    [tab, setTab] = useState<'sales' | 'cash'>('sales');
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['sales-history'] });
    void client.invalidateQueries({ queryKey: ['products'] });
    void client.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const sales = useQuery({
      queryKey: ['sales-history', search],
      queryFn: () => getSalesHistory(search),
    }),
    cash = useQuery({ queryKey: ['cash-history'], queryFn: getCashHistory });
  const voiding = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => voidSale(id, reason),
    onSuccess: refresh,
  });
  const returning = useMutation({
    mutationFn: ({
      saleId,
      saleItemId,
      quantity,
      reason,
    }: {
      saleId: string;
      saleItemId: string;
      quantity: number;
      reason: string;
    }) =>
      createSaleReturn({
        saleId,
        reason,
        idempotencyKey: crypto.randomUUID(),
        items: [{ saleItemId, quantity }],
      }),
    onSuccess: (r) => {
      refresh();
      alert(`Devolución registrada por ${money(r.return.total)}`);
    },
  });
  const requestVoid = (id: string) => {
    const reason = prompt('Motivo obligatorio de anulación');
    if (reason && reason.trim().length >= 3) voiding.mutate({ id, reason: reason.trim() });
  };
  const requestReturn = (saleId: string, itemId: string, max: number) => {
    const quantity = Number(prompt(`Cantidad a devolver (vendida: ${max})`));
    if (!quantity || quantity <= 0) return;
    const reason = prompt('Motivo obligatorio de devolución');
    if (reason && reason.trim().length >= 3)
      returning.mutate({ saleId, saleItemId: itemId, quantity, reason: reason.trim() });
  };
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Historial comercial</h2>
          <p>Ventas, devoluciones, anulaciones y arqueos.</p>
        </div>
        <div className="tabs">
          <button className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}>
            Ventas
          </button>
          <button className={tab === 'cash' ? 'active' : ''} onClick={() => setTab('cash')}>
            Cajas
          </button>
        </div>
      </div>
      {tab === 'sales' && (
        <>
          <div className="toolbar">
            <label className="search-box">
              <Search />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente o documento"
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sales.data?.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <code>#{s.number}</code>
                    </td>
                    <td>
                      {date(s.createdAt)}
                      <small>{s.user.displayName}</small>
                    </td>
                    <td>{s.customer?.name ?? 'Consumidor final'}</td>
                    <td>
                      {s.items.map((i) => (
                        <div className="sale-product" key={i.id}>
                          <span>
                            {i.product.commercialName} × {Number(i.quantity)}
                          </span>
                          {s.status === 'COMPLETED' && (
                            <button
                              className="link-button"
                              onClick={() => requestReturn(s.id, i.id, Number(i.quantity))}
                            >
                              Devolver
                            </button>
                          )}
                        </div>
                      ))}
                    </td>
                    <td>
                      <strong>{money(s.total)}</strong>
                    </td>
                    <td>{s.status}</td>
                    <td>
                      {s.status === 'COMPLETED' && (
                        <button className="danger-button" onClick={() => requestVoid(s.id)}>
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === 'cash' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Apertura</th>
                <th>Sede</th>
                <th>Fondo</th>
                <th>Esperado</th>
                <th>Contado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cash.data?.map((c) => (
                <tr key={c.id}>
                  <td>{date(c.openedAt)}</td>
                  <td>
                    {c.branch.name}
                    <small>{c.openedBy.displayName}</small>
                  </td>
                  <td>{money(c.openingAmount)}</td>
                  <td>{c.expectedAmount ? money(c.expectedAmount) : '—'}</td>
                  <td>{c.closingAmount ? money(c.closingAmount) : '—'}</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
const money = (v: string) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(v));
const date = (v: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v));
