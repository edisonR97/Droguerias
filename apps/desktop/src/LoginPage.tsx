import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@farmacore/validation';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { login } from './api';

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [serverError, setServerError] = useState('');
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const submit = form.handleSubmit(async (data) => {
    setServerError('');
    try {
      await login(data.email, data.password);
      onSuccess();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'No fue posible iniciar sesión');
    }
  });
  return (
    <div className="login-shell">
      <section className="login-hero">
        <div className="brand large">
          <span className="brand-mark">F+</span>
          <div>
            <strong>FarmaCore</strong>
            <small>ERP Ultimate</small>
          </div>
        </div>
        <div>
          <span className="eyebrow">Gestión farmacéutica profesional</span>
          <h1>Tu operación segura, incluso sin internet.</h1>
          <p>
            Inventario, ventas, caja y cumplimiento desde una plataforma local diseñada para
            droguerías colombianas.
          </p>
        </div>
        <div className="security-note">
          <ShieldCheck />
          <span>
            <strong>Conexión local protegida</strong>
            <small>Tus datos comerciales permanecen bajo tu control.</small>
          </span>
        </div>
      </section>
      <section className="login-form">
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <div className="form-icon">
            <LockKeyhole />
          </div>
          <h2>Bienvenido</h2>
          <p>Ingresa tus credenciales para continuar.</p>
          <label>
            Correo electrónico
            <input autoFocus autoComplete="username" {...form.register('email')} />
            <small>{form.formState.errors.email?.message}</small>
          </label>
          <label>
            Contraseña
            <input type="password" autoComplete="current-password" {...form.register('password')} />
            <small>{form.formState.errors.password?.message}</small>
          </label>
          {serverError && <div className="error">{serverError}</div>}
          <button className="primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Verificando…' : 'Ingresar al sistema'}
          </button>
          <span className="support">
            ¿Problemas para ingresar? Contacta al administrador local.
          </span>
        </form>
      </section>
    </div>
  );
}
