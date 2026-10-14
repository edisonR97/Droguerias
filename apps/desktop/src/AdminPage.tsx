import type { FormEvent } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminBranch,
  createAdminUser,
  activateLicense,
  getAdminContext,
  getLicenseStatus,
  resetAdminPassword,
  updateAdminBranch,
  updateAdminUser,
  updateEstablishment,
} from './api';
import { formValue } from './form-utils';

export function AdminPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const context = useQuery({ queryKey: ['admin'], queryFn: getAdminContext });
  const license = useQuery({ queryKey: ['license'], queryFn: getLicenseStatus });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
  };
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      setMessage('Cambios guardados correctamente.');
      refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });
  if (context.isLoading) return <div className="panel">Cargando configuración…</div>;
  if (context.isError) return <div className="error">{context.error.message}</div>;
  const data = context.data!;
  const createUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate(() =>
      createAdminUser({
        email: formValue(form, 'email'),
        displayName: formValue(form, 'displayName'),
        password: formValue(form, 'password'),
        roleCodes: [formValue(form, 'role')],
      }),
    );
    event.currentTarget.reset();
  };
  const createBranch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate(() =>
      createAdminBranch({ code: formValue(form, 'code'), name: formValue(form, 'name') }),
    );
    event.currentTarget.reset();
  };
  const saveBusiness = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate(() =>
      updateEstablishment({
        legalName: formValue(form, 'legalName'),
        tradeName: formValue(form, 'tradeName'),
        taxId: formValue(form, 'taxId'),
        timezone: formValue(form, 'timezone'),
        currency: formValue(form, 'currency'),
      }),
    );
  };
  const saveLicense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate(() => activateLicense(formValue(form, 'token')), {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['license'] }),
    });
  };
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Administración</h2>
          <p>Empresa, sedes, usuarios y acceso por roles.</p>
        </div>
      </div>
      {message && (
        <div className={message.includes('correctamente') ? 'success' : 'error'}>{message}</div>
      )}
      <form className="panel purchase-form" onSubmit={saveLicense}>
        <h3>Licencia comercial</h3>
        {license.data?.licensed && license.data.license ? (
          <div className="license-summary">
            <span className="status active">ACTIVA</span>
            <strong>{license.data.license.customerName}</strong>
            <span>
              {license.data.license.kind === 'PERPETUAL' ? 'Compra perpetua' : 'Alquiler'}
            </span>
            <span>
              {license.data.license.expiresAt
                ? `Vence ${new Date(license.data.license.expiresAt).toLocaleDateString('es-CO')}`
                : 'Sin vencimiento'}
            </span>
            <small>
              {license.data.license.maxUsers} usuarios ? {license.data.license.maxBranches} sedes
            </small>
          </div>
        ) : (
          <div className="error">Sin licencia activa: {license.data?.reason ?? 'consultando'}</div>
        )}
        <label>
          Token de licencia
          <textarea name="token" rows={4} minLength={40} required />
        </label>
        <button className="primary compact" disabled={mutation.isPending}>
          Activar licencia
        </button>
      </form>
      <div className="grid">
        <form className="panel purchase-form" onSubmit={saveBusiness}>
          <h3>Datos del establecimiento</h3>
          <label>
            Razón social
            <input name="legalName" defaultValue={data.establishment.legalName} required />
          </label>
          <label>
            Nombre comercial
            <input name="tradeName" defaultValue={data.establishment.tradeName} required />
          </label>
          <label>
            NIT / identificación
            <input name="taxId" defaultValue={data.establishment.taxId} required />
          </label>
          <label>
            Zona horaria
            <input name="timezone" defaultValue={data.establishment.timezone} required />
          </label>
          <label>
            Moneda
            <input
              name="currency"
              defaultValue={data.establishment.currency}
              maxLength={3}
              required
            />
          </label>
          <button className="primary compact" disabled={mutation.isPending}>
            Guardar empresa
          </button>
        </form>
        <form className="panel purchase-form" onSubmit={createBranch}>
          <h3>Nueva sede</h3>
          <label>
            Código
            <input name="code" minLength={2} required />
          </label>
          <label>
            Nombre
            <input name="name" minLength={2} required />
          </label>
          <button className="primary compact" disabled={mutation.isPending}>
            Crear sede
          </button>
          <div className="admin-list">
            {data.branches.map((branch) => (
              <div className="task" key={branch.id}>
                <span>
                  <strong>{branch.name}</strong>
                  <small>{branch.code}</small>
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    mutation.mutate(() => updateAdminBranch(branch.id, { active: !branch.active }))
                  }
                >
                  {branch.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
          </div>
        </form>
      </div>
      <form className="panel purchase-form" onSubmit={createUser}>
        <h3>Crear usuario</h3>
        <label>
          Nombre
          <input name="displayName" required />
        </label>
        <label>
          Correo
          <input name="email" type="email" required />
        </label>
        <label>
          Contraseña temporal
          <input name="password" type="password" minLength={12} required />
        </label>
        <label>
          Rol
          <select name="role">
            {data.roles.map((role) => (
              <option key={role.id} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary compact" disabled={mutation.isPending}>
          Crear usuario
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Último ingreso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.displayName}</strong>
                  <small>{user.email}</small>
                </td>
                <td>{user.roles.map((item) => item.role.name).join(', ')}</td>
                <td>
                  <span className={`status ${user.status === 'ACTIVE' ? 'active' : ''}`}>
                    {user.status}
                  </span>
                </td>
                <td>
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('es-CO') : 'Nunca'}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="secondary"
                      onClick={() =>
                        mutation.mutate(() =>
                          updateAdminUser(user.id, {
                            status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                          }),
                        )
                      }
                    >
                      {user.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        const password = window.prompt('Nueva contraseña (mínimo 12 caracteres)');
                        if (password) mutation.mutate(() => resetAdminPassword(user.id, password));
                      }}
                    >
                      Contraseña
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
