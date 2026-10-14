import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

interface ProviderResponse {
  status: 'ACCEPTED' | 'REJECTED' | 'PROCESSING';
  documentId?: string;
  cufe?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  message?: string;
}

export function normalizeProviderResponse(value: unknown): ProviderResponse {
  if (!value || typeof value !== 'object') throw new Error('Respuesta vacia del proveedor');
  const input = value as Record<string, unknown>;
  if (!['ACCEPTED', 'REJECTED', 'PROCESSING'].includes(String(input.status)))
    throw new Error('Estado desconocido del proveedor');
  return {
    status: String(input.status) as ProviderResponse['status'],
    ...(typeof input.documentId === 'string' ? { documentId: input.documentId } : {}),
    ...(typeof input.cufe === 'string' ? { cufe: input.cufe } : {}),
    ...(typeof input.xmlUrl === 'string' ? { xmlUrl: input.xmlUrl } : {}),
    ...(typeof input.pdfUrl === 'string' ? { pdfUrl: input.pdfUrl } : {}),
    ...(typeof input.message === 'string' ? { message: input.message } : {}),
  };
}

@Injectable()
export class ElectronicBillingService {
  constructor(private readonly prisma: PrismaService) {}

  list(establishmentId: string) {
    return this.prisma.electronicDocument.findMany({
      where: { establishmentId },
      include: { sale: { select: { id: true, number: true, total: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async submitSale(actor: RequestUser, saleId: string) {
    const document = await this.prisma.electronicDocument.findFirst({
      where: { saleId, establishmentId: actor.establishmentId },
      include: {
        establishment: true,
        sale: {
          include: {
            branch: true,
            customer: true,
            items: { include: { product: true } },
          },
        },
      },
    });
    if (!document?.sale)
      throw new NotFoundException('Documento electronico de venta no encontrado');
    if (document.status === 'ACCEPTED' || document.status === 'PROCESSING') return document;
    if (document.sale.status !== 'COMPLETED')
      throw new ConflictException('Solo se pueden emitir ventas completadas');
    const claimed = await this.prisma.electronicDocument.updateMany({
      where: { id: document.id, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, errorMessage: null },
    });
    if (claimed.count !== 1)
      throw new ConflictException('El documento ya esta siendo procesado o fue rechazado');

    const apiUrl = process.env.EINVOICE_API_URL?.trim();
    const apiKey = process.env.EINVOICE_API_KEY?.trim();
    if (!apiUrl || !apiKey) {
      await this.fail(document.id, 'Proveedor de facturacion electronica no configurado');
      throw new ServiceUnavailableException('Proveedor de facturacion electronica no configurado');
    }
    const payload = {
      idempotencyKey: document.idempotencyKey,
      documentType: document.type,
      issuedAt: document.sale.createdAt.toISOString(),
      currency: document.establishment.currency,
      seller: {
        taxId: document.establishment.taxId,
        legalName: document.establishment.legalName,
        tradeName: document.establishment.tradeName,
      },
      branch: { code: document.sale.branch.code, name: document.sale.branch.name },
      customer: document.sale.customer
        ? {
            documentType: document.sale.customer.documentType,
            documentNumber: document.sale.customer.documentNumber,
            name: document.sale.customer.name,
            email: document.sale.customer.email,
          }
        : null,
      totals: {
        subtotal: document.sale.subtotal.toFixed(2),
        tax: document.sale.tax.toFixed(2),
        total: document.sale.total.toFixed(2),
      },
      paymentMethod: document.sale.paymentMethod,
      lines: document.sale.items.map((item) => ({
        code: item.product.internalCode,
        description: item.product.commercialName,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toFixed(2),
        taxRate: item.taxRate.toString(),
        subtotal: item.subtotal.toFixed(2),
        tax: item.tax.toFixed(2),
        total: item.total.toFixed(2),
      })),
    };
    await this.prisma.electronicDocument.update({
      where: { id: document.id },
      data: { requestPayload: payload },
    });
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': document.idempotencyKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
      const raw: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`Proveedor respondio HTTP ${response.status}`);
      const result = normalizeProviderResponse(raw);
      return await this.prisma.electronicDocument.update({
        where: { id: document.id },
        data: {
          status: result.status,
          ...(result.documentId ? { providerDocumentId: result.documentId } : {}),
          ...(result.cufe ? { cufe: result.cufe } : {}),
          ...(result.xmlUrl ? { xmlUrl: result.xmlUrl } : {}),
          ...(result.pdfUrl ? { pdfUrl: result.pdfUrl } : {}),
          responsePayload: result as unknown as Prisma.InputJsonValue,
          errorMessage: result.status === 'REJECTED' ? (result.message ?? 'Rechazado') : null,
          issuedAt: result.status === 'ACCEPTED' ? new Date() : null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido del proveedor';
      await this.fail(document.id, message);
      throw new BadGatewayException('No fue posible emitir el documento; puede reintentarse');
    }
  }

  private fail(id: string, message: string) {
    return this.prisma.electronicDocument.update({
      where: { id },
      data: { status: 'FAILED', errorMessage: message.slice(0, 1000) },
    });
  }
}
