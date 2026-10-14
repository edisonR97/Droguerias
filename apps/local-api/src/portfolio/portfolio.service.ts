import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { postAutomaticEntry } from '../accounting/automatic-entry';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterPortfolioPaymentDto } from './portfolio.dto';

export function validatePortfolioPayment(amount: Prisma.Decimal, balance: Prisma.Decimal) {
  if (amount.lte(0)) throw new BadRequestException('El abono debe ser mayor a cero');
  if (amount.gt(balance)) throw new ConflictException('El abono supera el saldo pendiente');
  return true;
}

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  receivables(user: RequestUser) {
    return this.prisma.accountReceivable.findMany({
      where: { establishmentId: user.establishmentId },
      include: {
        customer: true,
        sale: { select: { number: true, createdAt: true } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  payables(user: RequestUser) {
    return this.prisma.accountPayable.findMany({
      where: { establishmentId: user.establishmentId },
      include: {
        supplier: true,
        purchaseOrder: { select: { number: true, createdAt: true } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  async summary(user: RequestUser) {
    const [receivable, payable, overdueReceivable, overduePayable] = await Promise.all([
      this.prisma.accountReceivable.aggregate({
        where: {
          establishmentId: user.establishmentId,
          status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        },
        _sum: { balance: true },
      }),
      this.prisma.accountPayable.aggregate({
        where: {
          establishmentId: user.establishmentId,
          status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        },
        _sum: { balance: true },
      }),
      this.prisma.accountReceivable.count({
        where: {
          establishmentId: user.establishmentId,
          status: { in: ['OPEN', 'PARTIALLY_PAID'] },
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.accountPayable.count({
        where: {
          establishmentId: user.establishmentId,
          status: { in: ['OPEN', 'PARTIALLY_PAID'] },
          dueDate: { lt: new Date() },
        },
      }),
    ]);
    return {
      receivableBalance: receivable._sum.balance ?? 0,
      payableBalance: payable._sum.balance ?? 0,
      overdueReceivable,
      overduePayable,
    };
  }

  payReceivable(user: RequestUser, id: string, input: RegisterPortfolioPaymentDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.receivablePayment.findUnique({
          where: {
            establishmentId_idempotencyKey: {
              establishmentId: user.establishmentId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (duplicate) return { payment: duplicate, idempotent: true };
        const account = await tx.accountReceivable.findFirst({
          where: {
            id,
            establishmentId: user.establishmentId,
            status: { in: ['OPEN', 'PARTIALLY_PAID'] },
          },
        });
        if (!account) throw new NotFoundException('Cuenta por cobrar abierta no encontrada');
        const amount = new Prisma.Decimal(input.amount);
        validatePortfolioPayment(amount, account.balance);
        const payment = await tx.receivablePayment.create({
          data: {
            establishmentId: user.establishmentId,
            accountReceivableId: account.id,
            amount,
            method: input.method,
            reference: input.reference?.trim() || null,
            idempotencyKey: input.idempotencyKey,
          },
        });
        const balance = account.balance.minus(amount);
        await tx.accountReceivable.update({
          where: { id: account.id },
          data: { balance, status: balance.isZero() ? 'PAID' : 'PARTIALLY_PAID' },
        });
        await postAutomaticEntry(tx, {
          establishmentId: user.establishmentId,
          userId: user.id,
          description: 'Recaudo de cartera de cliente',
          referenceType: 'RECEIVABLE_PAYMENT',
          referenceId: payment.id,
          lines: [
            { code: input.method === 'CASH' ? '110505' : '111005', debit: amount },
            { code: '130505', credit: amount },
          ],
        });
        return { payment, balance, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  payPayable(user: RequestUser, id: string, input: RegisterPortfolioPaymentDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.payablePayment.findUnique({
          where: {
            establishmentId_idempotencyKey: {
              establishmentId: user.establishmentId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (duplicate) return { payment: duplicate, idempotent: true };
        const account = await tx.accountPayable.findFirst({
          where: {
            id,
            establishmentId: user.establishmentId,
            status: { in: ['OPEN', 'PARTIALLY_PAID'] },
          },
        });
        if (!account) throw new NotFoundException('Cuenta por pagar abierta no encontrada');
        const amount = new Prisma.Decimal(input.amount);
        validatePortfolioPayment(amount, account.balance);
        const payment = await tx.payablePayment.create({
          data: {
            establishmentId: user.establishmentId,
            accountPayableId: account.id,
            amount,
            method: input.method,
            reference: input.reference?.trim() || null,
            idempotencyKey: input.idempotencyKey,
          },
        });
        const balance = account.balance.minus(amount);
        await tx.accountPayable.update({
          where: { id: account.id },
          data: { balance, status: balance.isZero() ? 'PAID' : 'PARTIALLY_PAID' },
        });
        await postAutomaticEntry(tx, {
          establishmentId: user.establishmentId,
          userId: user.id,
          description: 'Pago de cartera a proveedor',
          referenceType: 'PAYABLE_PAYMENT',
          referenceId: payment.id,
          lines: [
            { code: '220505', debit: amount },
            { code: input.method === 'CASH' ? '110505' : '111005', credit: amount },
          ],
        });
        return { payment, balance, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
