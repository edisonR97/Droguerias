import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { createCustomer, getCustomers } from './api';
import { formValue } from './form-utils';

export function CustomersPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [show, setShow] = useState(false);
  const customers = useQuery({
    queryKey: ['customers', search],
    queryFn: () => getCustomers(search),
  });
  const create = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['customers'] });
      setShow(false);
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const phone = formValue(data, 'phone');
    const email = formValue(data, 'email');
    create.mutate({
      documentType: formValue(data, 'documentType'),
      documentNumber: formValue(data, 'documentNumber'),
      name: formValue(data, 'name'),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
    });
  };
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Clientes</h2>
          <p>Datos para facturación, trazabilidad e historial de dispensación.</p>
        </div>
        <button className="primary compact" onClick={() => setShow(!show)}>
          <UserPlus />
          Nuevo cliente
        </button>
      </div>
      {show && (
        <form className="panel customer-form" onSubmit={submit}>
          <label>
            Tipo
            <select name="documentType">
              <option>CC</option>
              <option>CE</option>
              <option>NIT</option>
              <option>TI</option>
            </select>
          </label>
          <label>
            Documento
            <input name="documentNumber" required />
          </label>
          <label>
            Nombre
            <input name="name" required />
          </label>
          <label>
            Teléfono
            <input name="phone" />
          </label>
          <label>
            Correo
            <input name="email" type="email" />
          </label>
          <button className="primary compact" disabled={create.isPending}>
            Guardar
          </button>
          {create.isError && <div className="error">{create.error.message}</div>}
        </form>
      )}
      <div className="toolbar">
        <label className="search-box">
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nombre o documento"
          />
        </label>
      </div>
      {customers.isError && <div className="error">{customers.error.message}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Correo</th>
            </tr>
          </thead>
          <tbody>
            {customers.data?.map((c) => (
              <tr key={c.id}>
                <td>
                  <code>
                    {c.documentType} {c.documentNumber}
                  </code>
                </td>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>{c.phone ?? '—'}</td>
                <td>{c.email ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
