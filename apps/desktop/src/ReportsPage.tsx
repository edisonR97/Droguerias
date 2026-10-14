import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadSalesCsv, getReportSummary, type ReportSummary } from './api';

const iso = (date: Date) => date.toISOString().slice(0, 10);
const money = (value: string) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));

export function ReportsPage() {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [error, setError] = useState('');
  const report = useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => getReportSummary(from, to),
  });
  const exportCsv = async () => {
    try {
      setError('');
      await downloadSalesCsv(from, to);
    } catch (caught) {
      setError((caught as Error).message);
    }
  };
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Reportes y finanzas</h2>
          <p>Rentabilidad, caja, compras e inventario valorizado.</p>
        </div>
        <button
          className="primary compact"
          onClick={() => {
            void exportCsv();
          }}
        >
          Exportar ventas CSV
        </button>
      </div>
      <div className="panel purchase-form">
        <label>
          Desde
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      {report.isLoading ? (
        <div className="panel">Calculando indicadores…</div>
      ) : report.isError ? (
        <div className="error">{report.error.message}</div>
      ) : (
        <Report data={report.data!} />
      )}
    </section>
  );
}

function Report({ data }: { data: ReportSummary }) {
  return (
    <>
      <div className="cards">
        <Metric label="Ventas netas" value={money(data.netSales)} />
        <Metric label="Utilidad bruta" value={money(data.grossProfit)} />
        <Metric label="Devoluciones" value={money(data.refunds)} />
        <Metric label="Compras" value={money(data.purchases)} />
        <Metric label="Inventario al costo" value={money(data.inventoryCostValue)} />
        <Metric label="Inventario a venta" value={money(data.inventoryRetailValue)} />
        <Metric label="Diferencia de caja" value={money(data.cashDifference)} />
        <Metric label="Transacciones" value={String(data.salesCount)} />
      </div>
      <div className="grid">
        <div className="panel">
          <h3>Ventas por medio de pago</h3>
          {data.paymentMethods.length ? (
            data.paymentMethods.map((item) => (
              <div className="task" key={item.method}>
                <span>{item.method}</span>
                <b>{money(item.total)}</b>
              </div>
            ))
          ) : (
            <p>Sin ventas en el período.</p>
          )}
        </div>
        <div className="panel">
          <h3>Productos más vendidos</h3>
          {data.topProducts.length ? (
            data.topProducts.map((item) => (
              <div className="task" key={item.name}>
                <span>
                  {item.name}
                  <small>{Number(item.quantity)} unidades</small>
                </span>
                <b>{money(item.total)}</b>
              </div>
            ))
          ) : (
            <p>Sin productos vendidos.</p>
          )}
        </div>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Período seleccionado</small>
    </article>
  );
}
