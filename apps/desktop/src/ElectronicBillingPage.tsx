import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getElectronicDocuments, submitElectronicSale } from './api';

export function ElectronicBillingPage() {
  const client = useQueryClient();
  const documents = useQuery({
    queryKey: ['electronic-documents'],
    queryFn: getElectronicDocuments,
  });
  const submit = useMutation({
    mutationFn: submitElectronicSale,
    onSuccess: () => void client.invalidateQueries({ queryKey: ['electronic-documents'] }),
  });
  if (documents.isLoading) return <div className="panel">Cargando documentos electronicos...</div>;
  if (documents.isError) return <div className="error">{documents.error.message}</div>;
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Facturacion electronica</h2>
          <p>Envios, respuestas, CUFE y documentos del proveedor.</p>
        </div>
      </div>
      {submit.isError ? <div className="error">{submit.error.message}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Venta</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>CUFE</th>
              <th>Intentos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documents.data?.map((document) => (
              <tr key={document.id}>
                <td>
                  #{document.sale?.number ?? '-'}
                  <small>
                    {document.sale
                      ? new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: 'COP',
                        }).format(Number(document.sale.total))
                      : ''}
                  </small>
                </td>
                <td>{document.type}</td>
                <td>
                  <span className={`status ${document.status === 'ACCEPTED' ? 'active' : ''}`}>
                    {document.status}
                  </span>
                  {document.errorMessage ? <small>{document.errorMessage}</small> : null}
                </td>
                <td>{document.cufe ?? '-'}</td>
                <td>{document.attempts}</td>
                <td>
                  <div className="row-actions">
                    {document.saleId && ['PENDING', 'FAILED'].includes(document.status) ? (
                      <button
                        className="secondary"
                        disabled={submit.isPending}
                        onClick={() => submit.mutate(document.saleId!)}
                      >
                        Enviar
                      </button>
                    ) : null}
                    {document.pdfUrl ? (
                      <a href={document.pdfUrl} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                    ) : null}
                    {document.xmlUrl ? (
                      <a href={document.xmlUrl} target="_blank" rel="noreferrer">
                        XML
                      </a>
                    ) : null}
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
