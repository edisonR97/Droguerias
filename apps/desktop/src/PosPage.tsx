import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import {
  checkout,
  closeCash,
  getOpenCash,
  getCustomers,
  getPosContext,
  getProducts,
  openCash,
  type ProductListItem,
} from './api';
import './pos-controls.css';

type CartLine = { product: ProductListItem; quantity: number };

export function PosPage() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [received, setReceived] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT'>(
    'CASH',
  );
  const [customerId, setCustomerId] = useState('');
  const [receipt, setReceipt] = useState<{
    id: string;
    number: string;
    total: string;
    change: string;
  } | null>(null);
  const context = useQuery({ queryKey: ['pos-context'], queryFn: getPosContext });
  const products = useQuery({ queryKey: ['products', 'pos'], queryFn: () => getProducts('') });
  const customers = useQuery({ queryKey: ['customers', 'pos'], queryFn: () => getCustomers('') });
  const branchId = context.data?.branches[0]?.id ?? '';
  const cash = useQuery({
    queryKey: ['open-cash', branchId],
    queryFn: () => getOpenCash(branchId),
    enabled: Boolean(branchId),
  });
  const open = useMutation({
    mutationFn: () => openCash(branchId, 0),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['open-cash', branchId] });
    },
  });
  const close = useMutation({
    mutationFn: (amount: number) => closeCash(cash.data!.id, amount),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['open-cash', branchId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      alert(`Caja cerrada. Diferencia: ${money(result.difference)}`);
    },
  });
  const total = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.product.salePrice) * line.quantity, 0),
    [cart],
  );
  const sale = useMutation({
    mutationFn: () =>
      checkout({
        branchId,
        cashSessionId: cash.data!.id,
        paymentMethod,
        ...(customerId ? { customerId } : {}),
        receivedAmount: paymentMethod === 'CREDIT' ? 0 : Number(received),
        idempotencyKey: crypto.randomUUID(),
        items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      }),
    onSuccess: (result) => {
      setReceipt({
        id: result.sale.id,
        number: result.sale.number,
        total: result.sale.total,
        change: result.sale.changeAmount,
      });
      setCart([]);
      setReceived('');
      setCustomerId('');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
  const add = (product: ProductListItem) =>
    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      return found
        ? current.map((line) =>
            line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [...current, { product, quantity: 1 }];
    });
  const change = (id: string, delta: number) =>
    setCart((current) =>
      current.map((line) =>
        line.product.id === id ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line,
      ),
    );
  if (context.isLoading || products.isLoading)
    return <div className="panel">Preparando punto de venta…</div>;
  if (!branchId) return <div className="error">No existe una sede activa para vender.</div>;
  const requestClose = () => {
    const value = window.prompt('Efectivo contado al cerrar la caja');
    if (value !== null && value.trim() !== '' && !Number.isNaN(Number(value)))
      close.mutate(Number(value));
  };
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Punto de venta</h2>
          <p>Dispensación con salida automática por vencimiento FEFO.</p>
        </div>
        <div className="pos-actions">
          <span className={cash.data ? 'live' : 'result-count'}>
            {cash.data ? '● Caja abierta' : 'Caja cerrada'}
          </span>
          {cash.data && (
            <button className="secondary" onClick={requestClose} disabled={close.isPending}>
              Cerrar caja
            </button>
          )}
        </div>
      </div>
      {!cash.data && (
        <div className="panel cash-gate">
          <ShoppingCart />
          <div>
            <strong>Abra la caja para comenzar</strong>
            <span>La sesión quedará asociada a su usuario y sede.</span>
          </div>
          <button
            className="primary compact"
            onClick={() => open.mutate()}
            disabled={open.isPending}
          >
            Abrir caja
          </button>
        </div>
      )}
      {cash.data && (
        <div className="pos-grid">
          <div className="panel product-picker">
            <h3>Productos disponibles</h3>
            <div className="product-buttons">
              {products.data?.items.map((product) => {
                const stock = product.branchInventory.reduce(
                  (sum, row) => sum + Number(row.onHand) - Number(row.reserved),
                  0,
                );
                return (
                  <button key={product.id} disabled={stock <= 0} onClick={() => add(product)}>
                    <strong>{product.commercialName}</strong>
                    <span>
                      {money(product.salePrice)} · Stock {stock}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="panel cart">
            <h3>Venta actual</h3>
            {cart.length === 0 ? (
              <div className="cart-empty">Seleccione productos para agregarlos.</div>
            ) : (
              cart.map((line) => (
                <div className="cart-line" key={line.product.id}>
                  <div>
                    <strong>{line.product.commercialName}</strong>
                    <span>{money(String(Number(line.product.salePrice) * line.quantity))}</span>
                  </div>
                  <div className="qty">
                    <button onClick={() => change(line.product.id, -1)}>
                      <Minus />
                    </button>
                    <b>{line.quantity}</b>
                    <button onClick={() => change(line.product.id, 1)}>
                      <Plus />
                    </button>
                    <button
                      onClick={() =>
                        setCart(cart.filter((item) => item.product.id !== line.product.id))
                      }
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              ))
            )}
            <div className="pos-total">
              <span>Total</span>
              <strong>{money(String(total))}</strong>
            </div>
            <label>
              Medio de pago
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}
              >
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CREDIT">Crédito</option>
              </select>
            </label>
            <label>
              Cliente {paymentMethod === 'CREDIT' ? '(obligatorio)' : '(opcional)'}
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Consumidor final</option>
                {customers.data?.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · {customer.documentNumber}
                  </option>
                ))}
              </select>
            </label>
            {paymentMethod !== 'CREDIT' && (
              <label>
                Valor recibido
                <input
                  type="number"
                  min={0}
                  value={received}
                  onChange={(event) => setReceived(event.target.value)}
                />
              </label>
            )}
            {sale.isError && <div className="error">{sale.error.message}</div>}
            <button
              className="primary"
              disabled={
                !cart.length ||
                (paymentMethod === 'CASH' && Number(received) < total) ||
                (paymentMethod === 'CREDIT' && !customerId) ||
                sale.isPending
              }
              onClick={() => sale.mutate()}
            >
              Confirmar venta
            </button>
          </div>
        </div>
      )}
      {receipt && (
        <div className="success-receipt">
          <div>
            <strong>Venta #{receipt.number} completada</strong>
            <span>
              Total {money(receipt.total)} · Cambio {money(receipt.change)}
            </span>
          </div>
          <button className="secondary" onClick={() => window.print()}>
            Imprimir comprobante
          </button>
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
