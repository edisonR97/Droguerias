import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createJournalEntry,
  getAccountingAccounts,
  getJournalEntries,
  getTrialBalance,
  reverseJournalEntry,
} from './api';

const iso = (date: Date) => date.toISOString().slice(0, 10);
const money = (value: string | number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(value));

export function AccountingPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [date, setDate] = useState(iso(now));
  const [description, setDescription] = useState('');
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const accounts = useQuery({ queryKey: ['accounting-accounts'], queryFn: getAccountingAccounts });
  const entries = useQuery({ queryKey: ['journal-entries'], queryFn: getJournalEntries });
  const trial = useQuery({
    queryKey: ['trial-balance', from, to],
    queryFn: () => getTrialBalance(from, to),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] }),
      queryClient.invalidateQueries({ queryKey: ['trial-balance'] }),
    ]);
  };
  const create = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: async () => {
      setDescription('');
      setAmount('');
      setError('');
      await refresh();
    },
    onError: (caught) => setError(caught.message),
  });
  const reverse = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reverseJournalEntry(id, reason),
    onSuccess: refresh,
    onError: (caught) => setError(caught.message),
  });
  const submit = () => {
    const value = Number(amount);
    if (!description.trim() || !debitAccount || !creditAccount || debitAccount === creditAccount)
      return setError('Completa la descripción y selecciona dos cuentas diferentes.');
    if (!Number.isFinite(value) || value <= 0) return setError('El valor debe ser mayor que cero.');
    create.mutate({
      date,
      description: description.trim(),
      lines: [
        { accountId: debitAccount, debit: value, credit: 0 },
        { accountId: creditAccount, debit: 0, credit: value },
      ],
    });
  };
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Contabilidad</h2>
          <p>Plan de cuentas, comprobantes y balance de prueba.</p>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="panel purchase-form accounting-form">
        <label>
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Descripción
          <input
            value={description}
            maxLength={300}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Cuenta débito
          <select value={debitAccount} onChange={(e) => setDebitAccount(e.target.value)}>
            <option value="">Seleccionar</option>
            {accounts.data?.map((a) => (
              <option value={a.id} key={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cuenta crédito
          <select value={creditAccount} onChange={(e) => setCreditAccount(e.target.value)}>
            <option value="">Seleccionar</option>
            {accounts.data?.map((a) => (
              <option value={a.id} key={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <button className="primary compact" disabled={create.isPending} onClick={submit}>
          {create.isPending ? 'Registrando…' : 'Registrar asiento'}
        </button>
      </div>
      <div className="panel purchase-form">
        <label>
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="grid">
        <div className="panel table-wrap">
          <h3>Balance de comprobación</h3>
          <table>
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Débito</th>
                <th>Crédito</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {trial.data?.rows.map((row) => (
                <tr key={row.code}>
                  <td>
                    {row.code} · {row.name}
                  </td>
                  <td>{money(row.debit)}</td>
                  <td>{money(row.credit)}</td>
                  <td>{money(row.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th>{money(trial.data?.totalDebit ?? 0)}</th>
                <th>{money(trial.data?.totalCredit ?? 0)}</th>
                <th>
                  {Number(trial.data?.totalDebit ?? 0) === Number(trial.data?.totalCredit ?? 0)
                    ? 'Cuadrado'
                    : 'Revisar'}
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="panel">
          <h3>Comprobantes recientes</h3>
          {entries.data?.map((entry) => (
            <div className="task" key={entry.id}>
              <span>
                <strong>
                  #{entry.number} · {entry.description}
                </strong>
                <small>
                  {new Date(entry.date).toLocaleDateString('es-CO')} · {entry.status}
                </small>
              </span>
              <span>
                {entry.status === 'POSTED' && !entry.reversal ? (
                  <button
                    className="danger-button"
                    onClick={() => {
                      const reason = window.prompt('Motivo del reverso');
                      if (reason?.trim()) reverse.mutate({ id: entry.id, reason });
                    }}
                  >
                    Reversar
                  </button>
                ) : (
                  '—'
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
