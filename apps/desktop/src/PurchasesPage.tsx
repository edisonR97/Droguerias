import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePurchase,
  createPurchase,
  getProducts,
  getPurchaseContext,
  getPurchases,
  receivePurchase,
} from './api';
import './purchases.css';
import { formValue } from './form-utils';
export function PurchasesPage() {
  const client = useQueryClient();
  const [show, setShow] = useState(false);
  const context = useQuery({ queryKey: ['purchase-context'], queryFn: getPurchaseContext });
  const products = useQuery({ queryKey: ['products', 'purchase'], queryFn: () => getProducts('') });
  const orders = useQuery({ queryKey: ['purchases'], queryFn: getPurchases });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['purchases'] });
    void client.invalidateQueries({ queryKey: ['products'] });
    void client.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const create = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      refresh();
      setShow(false);
    },
  });
  const approve = useMutation({ mutationFn: approvePurchase, onSuccess: refresh });
  const receive = useMutation({
    mutationFn: ({ id, itemId }: { id: string; itemId: string }) => {
      const quantity = Number(prompt('Cantidad recibida'));
      const lotNumber = prompt('Número de lote') ?? '';
      const expiresAt = prompt('Vencimiento (AAAA-MM-DD)') ?? '';
      return receivePurchase(id, {
        idempotencyKey: crypto.randomUUID(),
        items: [{ itemId, quantity, lotNumber, expiresAt }],
      });
    },
    onSuccess: refresh,
  });
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    create.mutate({
      branchId: formValue(d, 'branch'),
      supplierId: formValue(d, 'supplier'),
      items: [
        {
          productId: formValue(d, 'product'),
          quantity: Number(d.get('quantity')),
          unitCost: Number(d.get('cost')),
          taxRate: 0,
        },
      ],
    });
  };
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Compras</h2>
          <p>Órdenes, aprobación y recepción trazable por lote.</p>
        </div>
        <button className="primary compact" onClick={() => setShow(!show)}>
          Nueva orden
        </button>
      </div>
      {show && (
        <form className="panel purchase-form" onSubmit={submit}>
          <label>
            Sede
            <select name="branch">
              {context.data?.branches.map((x) => (
                <option value={x.id}>{x.name}</option>
              ))}
            </select>
          </label>
          <label>
            Proveedor
            <select name="supplier">
              {context.data?.suppliers.map((x) => (
                <option value={x.id}>{x.legalName}</option>
              ))}
            </select>
          </label>
          <label>
            Producto
            <select name="product">
              {products.data?.items.map((x) => (
                <option value={x.id}>{x.commercialName}</option>
              ))}
            </select>
          </label>
          <label>
            Cantidad
            <input name="quantity" type="number" min="1" required />
          </label>
          <label>
            Costo unitario
            <input name="cost" type="number" min="0" required />
          </label>
          <button className="primary compact">Crear</button>
        </form>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Orden</th>
              <th>Proveedor</th>
              <th>Producto</th>
              <th>Pedido / recibido</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {orders.data?.map((o) => (
              <tr key={o.id}>
                <td>
                  <code>#{o.number}</code>
                  <small>{new Date(o.createdAt).toLocaleDateString('es-CO')}</small>
                </td>
                <td>{o.supplier.legalName}</td>
                <td>{o.items.map((i) => i.product.commercialName).join(', ')}</td>
                <td>
                  {o.items
                    .map((i) => `${Number(i.orderedQuantity)} / ${Number(i.receivedQuantity)}`)
                    .join(', ')}
                </td>
                <td>{money(o.total)}</td>
                <td>
                  <span className="status active">{o.status}</span>
                </td>
                <td>
                  {o.status === 'DRAFT' ? (
                    <button className="secondary" onClick={() => approve.mutate(o.id)}>
                      Aprobar
                    </button>
                  ) : ['APPROVED', 'PARTIALLY_RECEIVED'].includes(o.status) ? (
                    <button
                      className="secondary"
                      onClick={() =>
                        receive.mutate({
                          id: o.id,
                          itemId: o.items.find(
                            (i) => Number(i.receivedQuantity) < Number(i.orderedQuantity),
                          )!.id,
                        })
                      }
                    >
                      Recibir
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
    </section>
  );
}
const money = (v: string) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(v));
