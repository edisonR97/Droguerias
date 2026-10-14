import { useState } from 'react';
import { Building2, ShieldCheck } from 'lucide-react';
import { completeProvisioning } from './api';

function field(values: FormData, name: string) {
  const value = values.get(name);
  return typeof value === 'string' ? value : '';
}

export function ProvisioningPage({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);
    const values = new FormData(event.currentTarget);
    try {
      await completeProvisioning({
        setupToken: field(values, 'setupToken'),
        legalName: field(values, 'legalName'),
        tradeName: field(values, 'tradeName'),
        taxId: field(values, 'taxId'),
        branchCode: field(values, 'branchCode'),
        branchName: field(values, 'branchName'),
        ownerEmail: field(values, 'ownerEmail'),
        ownerName: field(values, 'ownerName'),
        ownerPassword: field(values, 'ownerPassword'),
      });
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible configurar FarmaCore');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="setup-shell">
      <section className="setup-card">
        <div className="form-icon">
          <Building2 />
        </div>
        <span className="eyebrow">Primera instalacion</span>
        <h1>Configura tu drogueria</h1>
        <p>
          Este proceso crea el establecimiento, la sede principal y el propietario. Solo puede
          ejecutarse una vez.
        </p>
        <form onSubmit={(event) => void submit(event)}>
          <div className="setup-grid">
            <label>
              Razon social
              <input name="legalName" required minLength={2} />
            </label>
            <label>
              Nombre comercial
              <input name="tradeName" required minLength={2} />
            </label>
            <label>
              NIT o documento
              <input name="taxId" required minLength={3} />
            </label>
            <label>
              Codigo de sede
              <input name="branchCode" defaultValue="PRINCIPAL" required minLength={2} />
            </label>
            <label>
              Nombre de sede
              <input name="branchName" defaultValue="Sucursal principal" required />
            </label>
            <label>
              Nombre del propietario
              <input name="ownerName" required minLength={2} />
            </label>
            <label>
              Correo del propietario
              <input name="ownerEmail" type="email" required />
            </label>
            <label>
              Contrase?a inicial
              <input
                name="ownerPassword"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
              />
            </label>
          </div>
          <label>
            Token de instalacion
            <input name="setupToken" type="password" required minLength={32} autoComplete="off" />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button className="primary" disabled={saving}>
            {saving ? 'Configurando...' : 'Completar instalacion'}
          </button>
        </form>
        <div className="security-note light">
          <ShieldCheck />
          <span>El token se usa una sola vez y no se almacena en la base de datos.</span>
        </div>
      </section>
    </div>
  );
}
