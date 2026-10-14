import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, createPublicKey, verify } from 'node:crypto';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export interface LicensePayload {
  version: 1;
  licenseId: string;
  kind: 'SUBSCRIPTION' | 'PERPETUAL';
  customerName: string;
  taxId: string;
  issuedAt: string;
  expiresAt?: string;
  maxBranches: number;
  maxUsers: number;
  features: string[];
}

function decodePart(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function verifyLicenseToken(token: string, publicKeyBase64: string, now = new Date()) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new BadRequestException('La licencia no tiene un formato valido');
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  let header: { alg?: string; typ?: string };
  let payload: LicensePayload;
  try {
    header = JSON.parse(decodePart(headerPart)) as typeof header;
    payload = JSON.parse(decodePart(payloadPart)) as LicensePayload;
  } catch {
    throw new BadRequestException('La licencia contiene datos invalidos');
  }
  if (header.alg !== 'EdDSA' || header.typ !== 'FARMACORE-LICENSE')
    throw new BadRequestException('El algoritmo de la licencia no es aceptado');
  let validSignature = false;
  try {
    const key = createPublicKey(Buffer.from(publicKeyBase64, 'base64').toString('utf8'));
    validSignature = verify(
      null,
      Buffer.from(`${headerPart}.${payloadPart}`),
      key,
      Buffer.from(signaturePart, 'base64url'),
    );
  } catch {
    throw new BadRequestException('No fue posible validar la clave de licencia');
  }
  if (!validSignature) throw new BadRequestException('La firma de la licencia es invalida');
  if (
    payload.version !== 1 ||
    !payload.licenseId ||
    !payload.customerName ||
    !payload.taxId ||
    !['SUBSCRIPTION', 'PERPETUAL'].includes(payload.kind) ||
    !Number.isInteger(payload.maxBranches) ||
    payload.maxBranches < 1 ||
    !Number.isInteger(payload.maxUsers) ||
    payload.maxUsers < 1 ||
    !Array.isArray(payload.features)
  )
    throw new BadRequestException('Los datos de la licencia estan incompletos');
  const issuedAt = new Date(payload.issuedAt);
  if (Number.isNaN(issuedAt.getTime()) || issuedAt.getTime() > now.getTime() + 300_000)
    throw new BadRequestException('La fecha de emision de la licencia es invalida');
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  if (payload.kind === 'SUBSCRIPTION' && !expiresAt)
    throw new BadRequestException('La suscripcion debe tener fecha de vencimiento');
  if (payload.kind === 'PERPETUAL' && expiresAt)
    throw new BadRequestException('La licencia perpetua no debe vencer');
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= now))
    throw new BadRequestException('La licencia esta vencida');
  return { payload, issuedAt, expiresAt };
}

@Injectable()
export class LicensingService {
  constructor(private readonly prisma: PrismaService) {}

  async status(establishmentId: string) {
    const license = await this.prisma.commercialLicense.findFirst({
      where: { establishmentId, status: 'ACTIVE' },
      orderBy: { activatedAt: 'desc' },
      select: {
        licenseId: true,
        kind: true,
        customerName: true,
        issuedAt: true,
        expiresAt: true,
        maxBranches: true,
        maxUsers: true,
        features: true,
        activatedAt: true,
      },
    });
    if (!license) return { licensed: false, reason: 'NOT_ACTIVATED' };
    const expired = Boolean(license.expiresAt && license.expiresAt <= new Date());
    return { licensed: !expired, reason: expired ? 'EXPIRED' : null, license };
  }

  async activate(actor: RequestUser, token: string) {
    const publicKey = process.env.LICENSE_PUBLIC_KEY_BASE64?.trim();
    if (!publicKey)
      throw new ServiceUnavailableException(
        'La clave publica de licenciamiento no esta configurada',
      );
    const { payload, issuedAt, expiresAt } = verifyLicenseToken(token, publicKey);
    const establishment = await this.prisma.establishment.findUniqueOrThrow({
      where: { id: actor.establishmentId },
      select: { taxId: true },
    });
    if (payload.taxId.trim() !== establishment.taxId.trim())
      throw new BadRequestException('La licencia pertenece a otro NIT o documento');
    const digest = createHash('sha256').update(token).digest('hex');
    await this.prisma.$transaction(async (tx) => {
      await tx.commercialLicense.updateMany({
        where: { establishmentId: actor.establishmentId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      await tx.commercialLicense.upsert({
        where: { licenseId: payload.licenseId },
        update: {
          establishmentId: actor.establishmentId,
          status: 'ACTIVE',
          tokenDigest: digest,
          signedToken: token,
          expiresAt,
          revokedAt: null,
          activatedAt: new Date(),
        },
        create: {
          establishmentId: actor.establishmentId,
          kind: payload.kind,
          licenseId: payload.licenseId,
          customerName: payload.customerName,
          tokenDigest: digest,
          signedToken: token,
          issuedAt,
          expiresAt,
          maxBranches: payload.maxBranches,
          maxUsers: payload.maxUsers,
          features: payload.features,
        },
      });
      await tx.auditLog.create({
        data: {
          establishmentId: actor.establishmentId,
          userId: actor.id,
          action: 'license.activate',
          entityType: 'CommercialLicense',
          entityId: payload.licenseId,
          outcome: 'SUCCESS',
          metadata: { kind: payload.kind, expiresAt: payload.expiresAt ?? null },
        },
      });
    });
    return this.status(actor.establishmentId);
  }
}
