import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import {
  ArrowLeftRight,
  BookOpenCheck,
  WalletCards,
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Moon,
  PackageSearch,
  ReceiptText,
  FileCheck2,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
  Users,
} from 'lucide-react';
import { getDashboard, getMe, getProvisioningStatus, logout } from './api';
import { LoginPage } from './LoginPage';
import { ProductsPage } from './ProductsPage';
import { InventoryPage } from './InventoryPage';
import { PosPage } from './PosPage';
import './modules.css';
import { CustomersPage } from './CustomersPage';
import { SalesHistoryPage } from './SalesHistoryPage';
import { PurchasesPage } from './PurchasesPage';
import { InventoryOperationsPage } from './InventoryOperationsPage';
import { AdminPage } from './AdminPage';
import { ReportsPage } from './ReportsPage';
import { AccountingPage } from './AccountingPage';
import { PortfolioPage } from './PortfolioPage';
import { ProvisioningPage } from './ProvisioningPage';
import { ElectronicBillingPage } from './ElectronicBillingPage';

export function App() {
  const queryClient = useQueryClient();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const provisioning = useQuery({
    queryKey: ['provisioning'],
    queryFn: getProvisioningStatus,
    retry: false,
  });
  const session = useQuery({ queryKey: ['session'], queryFn: getMe, retry: false });
  if (provisioning.isLoading) return <div className="center">Comprobando instalacion...</div>;
  if (provisioning.data?.required)
    return (
      <ProvisioningPage
        onSuccess={() => void queryClient.invalidateQueries({ queryKey: ['provisioning'] })}
      />
    );
  if (session.isLoading) return <div className="center">Conectando con el servicio local…</div>;
  if (session.isError || !session.data)
    return (
      <LoginPage
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ['session'] });
        }}
      />
    );
  const signOut = () => {
    void logout().finally(() => queryClient.clear());
  };
  return (
    <div className={dark ? 'app dark' : 'app'}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">F+</span>
          <div>
            <strong>FarmaCore</strong>
            <small>ERP Ultimate</small>
          </div>
        </div>
        <nav aria-label="Navegación principal">
          <NavLink to="/dashboard">
            <LayoutDashboard />
            Inicio
          </NavLink>
          <NavLink to="/pos">
            <ShoppingCart />
            Punto de venta
          </NavLink>
          <NavLink to="/inventory">
            <Boxes />
            Inventario
          </NavLink>
          <NavLink to="/products">
            <PackageSearch />
            Productos
          </NavLink>
          <NavLink to="/customers">
            <Users />
            Clientes
          </NavLink>
          <NavLink to="/sales">
            <ReceiptText />
            Historial
          </NavLink>
          <NavLink to="/purchases">
            <Truck />
            Compras
          </NavLink>
          <NavLink to="/inventory-operations">
            <ArrowLeftRight />
            Operaciones
          </NavLink>
          {session.data.permissions.includes('reports.export') ? (
            <NavLink to="/reports">
              <BarChart3 />
              Reportes
            </NavLink>
          ) : null}
          {session.data.permissions.includes('accounting.read') ? (
            <NavLink to="/accounting">
              <BookOpenCheck />
              Contabilidad
            </NavLink>
          ) : null}
          {session.data.permissions.includes('electronic-billing.manage') ? (
            <NavLink to="/electronic-billing">
              <FileCheck2 />
              Facturacion electronica
            </NavLink>
          ) : null}
          {session.data.permissions.includes('portfolio.read') ? (
            <NavLink to="/portfolio">
              <WalletCards />
              Cartera
            </NavLink>
          ) : null}
          {session.data.permissions.includes('users.manage') ? (
            <NavLink to="/admin">
              <Settings />
              Administración
            </NavLink>
          ) : null}
        </nav>
        <button className="ghost" onClick={signOut}>
          <LogOut />
          Cerrar sesión
        </button>
      </aside>
      <main>
        <header>
          <div>
            <small>Droguería Central · Principal</small>
            <h1>Buenos días, {session.data.displayName}</h1>
          </div>
          <button
            className="icon"
            aria-label="Cambiar tema"
            onClick={() => {
              const next = !dark;
              setDark(next);
              localStorage.setItem('theme', next ? 'dark' : 'light');
            }}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
        </header>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/sales" element={<SalesHistoryPage />} />
          <Route path="/purchases" element={<PurchasesPage />} />
          <Route path="/inventory-operations" element={<InventoryOperationsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/accounting" element={<AccountingPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/electronic-billing" element={<ElectronicBillingPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Dashboard() {
  const summary = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });
  if (summary.isLoading) return <div className="panel">Cargando indicadores…</div>;
  if (summary.isError)
    return (
      <div className="error">No se pudieron cargar los indicadores: {summary.error.message}</div>
    );
  const data = summary.data!;
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Resumen operativo</h2>
          <p>Estado del establecimiento en tiempo real.</p>
        </div>
        <span className="live">
          <i />
          Servicio local conectado
        </span>
      </div>
      <div className="cards">
        <Metric label="Ventas de hoy" value={money(data.salesToday)} />
        <Metric label="Utilidad bruta" value={money(data.grossProfitToday)} />
        <Metric label="Stock bajo" value={String(data.lowStockItems)} tone="warning" />
        <Metric label="Lotes por vencer" value={String(data.expiringLots)} tone="danger" />
      </div>
      <div className="grid">
        <div className="panel">
          <h3>Actividad comercial</h3>
          <div className="empty-chart">
            <BarChart3 />
            <strong>Sin ventas registradas</strong>
            <span>Los datos aparecerán al habilitar el módulo POS.</span>
          </div>
        </div>
        <div className="panel">
          <h3>Atención requerida</h3>
          <div className="task">
            <span>Sesiones de caja abiertas</span>
            <b>{data.openCashSessions}</b>
          </div>
          <div className="task">
            <span>Productos con stock bajo</span>
            <b>{data.lowStockItems}</b>
          </div>
          <div className="task">
            <span>Lotes próximos a vencer</span>
            <b>{data.expiringLots}</b>
          </div>
        </div>
      </div>
    </section>
  );
}
function Metric({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Datos operativos</small>
    </article>
  );
}
function money(value: string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
