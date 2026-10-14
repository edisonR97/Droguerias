import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPayables, getPortfolioSummary, getReceivables, payPayable, payReceivable } from './api';

const money = (value: string | number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(value));

export function PortfolioPage() {
  const client = useQueryClient();
  const summary = useQuery({ queryKey: ['portfolio-summary'], queryFn: getPortfolioSummary });
  const receivables = useQuery({ queryKey: ['receivables'], queryFn: getReceivables });
  const payables = useQuery({ queryKey: ['payables'], queryFn: getPayables });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['portfolio-summary'] }),
      client.invalidateQueries({ queryKey: ['receivables'] }),
      client.invalidateQueries({ queryKey: ['payables'] }),
      client.invalidateQueries({ queryKey: ['journal-entries'] }),
    ]);
  };
  const collect = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      payReceivable(id, amount, 'CASH'),
    onSuccess: refresh,
  });
  const pay = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      payPayable(id, amount, 'TRANSFER'),
    onSuccess: refresh,
  });
  const requestAmount = (balance: string, action: (amount: number) => void) => {
    const entered = window.prompt(`Valor (saldo ${money(balance)})`, balance);
    const amount = Number(entered);
    if (entered && Number.isFinite(amount) && amount > 0 && amount <= Number(balance))
      action(amount);
  };
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Cartera</h2>
          <p>Cuentas por cobrar y pagar con vencimientos y abonos.</p>
        </div>
      </div>
      <div className="cards">
        <Metric label="Por cobrar" value={money(summary.data?.receivableBalance ?? 0)} />
        <Metric label="Por pagar" value={money(summary.data?.payableBalance ?? 0)} />
        <Metric label="Clientes vencidos" value={String(summary.data?.overdueReceivable ?? 0)} />
        <Metric label="Proveedores vencidos" value={String(summary.data?.overduePayable ?? 0)} />
      </div>
      {(collect.isError || pay.isError) && (
        <div className="error">{(collect.error ?? pay.error)?.message}</div>
      )}
      <div className="grid">
        <div className="panel">
          <h3>Cuentas por cobrar</h3>
          {receivables.data?.length ? (
            receivables.data.map((item) => (
              <div className="task" key={item.id}>
                <span>
                  <strong>
                    {item.customer.name} · Venta #{item.sale.number}
                  </strong>
                  <small>
                    Vence {new Date(item.dueDate).toLocaleDateString('es-CO')} · {item.status}
                  </small>
                </span>
                <span>
                  <b>{money(item.balance)}</b>
                  {['OPEN', 'PARTIALLY_PAID'].includes(item.status) && (
                    <button
                      className="secondary"
                      onClick={() =>
                        requestAmount(item.balance, (amount) =>
                          collect.mutate({ id: item.id, amount }),
                        )
                      }
                    >
                      Registrar recaudo
                    </button>
                  )}
                </span>
              </div>
            ))
          ) : (
            <p>Sin cuentas por cobrar.</p>
          )}
        </div>
        <div className="panel">
          <h3>Cuentas por pagar</h3>
          {payables.data?.length ? (
            payables.data.map((item) => (
              <div className="task" key={item.id}>
                <span>
                  <strong>
                    {item.supplier.legalName} · Compra #{item.purchaseOrder.number}
                  </strong>
                  <small>
                    Vence {new Date(item.dueDate).toLocaleDateString('es-CO')} · {item.status}
                  </small>
                </span>
                <span>
                  <b>{money(item.balance)}</b>
                  {['OPEN', 'PARTIALLY_PAID'].includes(item.status) && (
                    <button
                      className="secondary"
                      onClick={() =>
                        requestAmount(item.balance, (amount) => pay.mutate({ id: item.id, amount }))
                      }
                    >
                      Registrar pago
                    </button>
                  )}
                </span>
              </div>
            ))
          ) : (
            <p>Sin cuentas por pagar.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Saldo vigente</small>
    </article>
  );
}
