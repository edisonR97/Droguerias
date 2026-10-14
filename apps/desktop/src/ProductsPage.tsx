import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageSearch, Search } from 'lucide-react';
import { getProducts } from './api';

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const products = useQuery({ queryKey: ['products', search], queryFn: () => getProducts(search) });
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Catálogo de productos</h2>
          <p>Medicamentos y artículos disponibles en el establecimiento.</p>
        </div>
        <span className="result-count">{products.data?.total ?? 0} productos</span>
      </div>
      <div className="toolbar">
        <label className="search-box">
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, código, principio activo o código de barras"
          />
        </label>
      </div>
      {products.isLoading && <div className="panel">Cargando catálogo…</div>}
      {products.isError && (
        <div className="error">No se pudo cargar el catálogo: {products.error.message}</div>
      )}
      {products.data && products.data.items.length === 0 && (
        <Empty
          icon={<PackageSearch />}
          title="No hay productos"
          text="Registre productos para iniciar la operación de inventario."
        />
      )}
      {products.data && products.data.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Presentación</th>
                <th>Existencia</th>
                <th>Precio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {products.data.items.map((product) => {
                const stock = product.branchInventory.reduce(
                  (total, row) => total + Number(row.onHand) - Number(row.reserved),
                  0,
                );
                return (
                  <tr key={product.id}>
                    <td>
                      <code>{product.internalCode}</code>
                    </td>
                    <td>
                      <strong>{product.commercialName}</strong>
                      <small>
                        {product.genericName ??
                          product.laboratory?.name ??
                          'Sin descripción adicional'}
                      </small>
                    </td>
                    <td>{product.category.name}</td>
                    <td>{product.presentation}</td>
                    <td className={stock <= Number(product.minimumStock) ? 'cell-warning' : ''}>
                      {stock.toLocaleString('es-CO')}
                    </td>
                    <td>{money(product.salePrice)}</td>
                    <td>
                      <span className={`status ${product.status.toLowerCase()}`}>
                        {product.status === 'ACTIVE' ? 'Activo' : product.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="panel empty-state">
      {icon}
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
function money(value: string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
