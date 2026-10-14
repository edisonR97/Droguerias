import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateAccountDto,
  CreateJournalEntryDto,
  ReverseEntryDto,
  TrialBalanceQueryDto,
} from './accounting.dto';

export function validateJournalLine(debit: Prisma.Decimal, credit: Prisma.Decimal) {
  if (debit.lt(0) || credit.lt(0))
    throw new BadRequestException('Cada importe del asiento debe ser mayor o igual a cero');
  if (debit.isZero() && credit.isZero())
    throw new BadRequestException('Cada línea debe tener débito o crédito, pero no ambos en cero');
  if (debit.gt(0) && credit.gt(0))
    throw new BadRequestException('Cada línea debe tener débito o crédito, pero no ambos');
  return true;
}

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  accounts(user: RequestUser) {
    return this.prisma.account.findMany({
      where: { establishmentId: user.establishmentId },
      orderBy: { code: 'asc' },
    });
  }

  async createAccount(user: RequestUser, input: CreateAccountDto) {
    if (input.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: { id: input.parentId, establishmentId: user.establishmentId },
      });
      if (!parent) throw new NotFoundException('Cuenta padre no encontrada');
    }
    return this.prisma.account.create({
      data: {
        establishmentId: user.establishmentId,
        code: input.code.trim(),
        name: input.name.trim(),
        type: input.type,
        parentId: input.parentId ?? null,
      },
    });
  }

  entries(user: RequestUser) {
    return this.prisma.journalEntry.findMany({
      where: { establishmentId: user.establishmentId },
      include: {
        createdBy: { select: { displayName: true } },
        lines: { include: { account: true } },
        reversal: { select: { id: true, number: true } },
      },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: 200,
    });
  }

  async createEntry(user: RequestUser, input: CreateJournalEntryDto) {
    const prepared = this.prepareLines(input.lines);
    return this.prisma.$transaction(
      async (tx) => {
        const accounts = await tx.account.findMany({
          where: {
            id: { in: prepared.map((line) => line.accountId) },
            establishmentId: user.establishmentId,
            active: true,
            allowEntries: true,
          },
        });
        if (accounts.length !== new Set(prepared.map((line) => line.accountId)).size)
          throw new NotFoundException('Una o más cuentas no permiten movimientos');
        const entry = await tx.journalEntry.create({
          data: {
            establishmentId: user.establishmentId,
            createdById: user.id,
            date: input.date,
            description: input.description.trim(),
            referenceType: input.referenceType ?? null,
            referenceId: input.referenceId ?? null,
            status: 'POSTED',
            postedAt: new Date(),
            lines: { create: prepared },
          },
          include: { lines: { include: { account: true } } },
        });
        await tx.auditLog.create({
          data: {
            establishmentId: user.establishmentId,
            userId: user.id,
            action: 'accounting.entry.post',
            entityType: 'JournalEntry',
            entityId: entry.id,
            outcome: 'SUCCESS',
            metadata: {
              debit: prepared
                .reduce((sum, line) => sum.plus(line.debit), new Prisma.Decimal(0))
                .toString(),
            },
          },
        });
        return entry;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async reverse(user: RequestUser, id: string, input: ReverseEntryDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const original = await tx.journalEntry.findFirst({
          where: { id, establishmentId: user.establishmentId, status: 'POSTED', reversal: null },
          include: { lines: true },
        });
        if (!original)
          throw new ConflictException(
            'El asiento no existe, no está contabilizado o ya fue reversado',
          );
        const reversal = await tx.journalEntry.create({
          data: {
            establishmentId: user.establishmentId,
            createdById: user.id,
            reversalOfId: original.id,
            date: new Date(),
            description: `Reverso #${original.number}: ${input.reason.trim()}`,
            referenceType: 'JOURNAL_REVERSAL',
            referenceId: original.id,
            status: 'POSTED',
            postedAt: new Date(),
            lines: {
              create: original.lines.map((line) => ({
                accountId: line.accountId,
                description: line.description,
                debit: line.credit,
                credit: line.debit,
              })),
            },
          },
          include: { lines: { include: { account: true } } },
        });
        await tx.journalEntry.update({ where: { id: original.id }, data: { status: 'REVERSED' } });
        await tx.auditLog.create({
          data: {
            establishmentId: user.establishmentId,
            userId: user.id,
            action: 'accounting.entry.reverse',
            entityType: 'JournalEntry',
            entityId: original.id,
            outcome: 'SUCCESS',
            reason: input.reason.trim(),
            metadata: { reversalId: reversal.id },
          },
        });
        return reversal;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async trialBalance(user: RequestUser, query: TrialBalanceQueryDto) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          establishmentId: user.establishmentId,
          status: { in: ['POSTED', 'REVERSED'] },
          date: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        },
      },
      include: { account: true },
    });
    const zero = new Prisma.Decimal(0);
    const balances = new Map<
      string,
      { code: string; name: string; type: string; debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const line of lines) {
      const row = balances.get(line.accountId) ?? {
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        debit: zero,
        credit: zero,
      };
      row.debit = row.debit.plus(line.debit);
      row.credit = row.credit.plus(line.credit);
      balances.set(line.accountId, row);
    }
    const rows = [...balances.values()].sort((a, b) => a.code.localeCompare(b.code));
    return {
      rows: rows.map((row) => ({ ...row, balance: row.debit.minus(row.credit) })),
      totalDebit: rows.reduce((sum, row) => sum.plus(row.debit), zero),
      totalCredit: rows.reduce((sum, row) => sum.plus(row.credit), zero),
    };
  }

  private prepareLines(lines: CreateJournalEntryDto['lines']) {
    const prepared = lines.map((line) => {
      const debit = new Prisma.Decimal(line.debit);
      const credit = new Prisma.Decimal(line.credit);
      validateJournalLine(debit, credit);
      return {
        accountId: line.accountId,
        description: line.description?.trim() ?? null,
        debit,
        credit,
      };
    });
    const debit = prepared.reduce((sum, line) => sum.plus(line.debit), new Prisma.Decimal(0));
    const credit = prepared.reduce((sum, line) => sum.plus(line.credit), new Prisma.Decimal(0));
    if (debit.isZero() || !debit.equals(credit))
      throw new BadRequestException('El asiento no está balanceado');
    return prepared;
  }
}
