import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface AutomaticLine {
  code: string;
  debit?: Prisma.Decimal;
  credit?: Prisma.Decimal;
  description?: string;
}

export async function postAutomaticEntry(
  tx: Prisma.TransactionClient,
  input: {
    establishmentId: string;
    userId: string;
    date?: Date;
    description: string;
    referenceType: string;
    referenceId: string;
    lines: AutomaticLine[];
  },
) {
  const meaningful = input.lines.filter(
    (line) => !(line.debit?.isZero() ?? true) || !(line.credit?.isZero() ?? true),
  );
  const codes = [...new Set(meaningful.map((line) => line.code))];
  const accounts = await tx.account.findMany({
    where: {
      establishmentId: input.establishmentId,
      code: { in: codes },
      active: true,
      allowEntries: true,
    },
  });
  if (accounts.length !== codes.length)
    throw new ConflictException(
      `Configuración contable incompleta. Se requieren las cuentas: ${codes.join(', ')}`,
    );
  const byCode = new Map(accounts.map((account) => [account.code, account.id]));
  const debit = meaningful.reduce((sum, line) => sum.plus(line.debit ?? 0), new Prisma.Decimal(0));
  const credit = meaningful.reduce(
    (sum, line) => sum.plus(line.credit ?? 0),
    new Prisma.Decimal(0),
  );
  if (debit.isZero() || !debit.equals(credit))
    throw new ConflictException('La configuración generó un asiento automático desbalanceado');
  return tx.journalEntry.create({
    data: {
      establishmentId: input.establishmentId,
      createdById: input.userId,
      date: input.date ?? new Date(),
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      status: 'POSTED',
      postedAt: new Date(),
      lines: {
        create: meaningful.map((line) => ({
          accountId: byCode.get(line.code)!,
          description: line.description ?? null,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
        })),
      },
    },
  });
}

export async function reverseAutomaticEntry(
  tx: Prisma.TransactionClient,
  input: {
    establishmentId: string;
    userId: string;
    referenceType: string;
    referenceId: string;
    reason: string;
  },
) {
  const original = await tx.journalEntry.findFirst({
    where: {
      establishmentId: input.establishmentId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      status: 'POSTED',
      reversal: null,
    },
    include: { lines: true },
  });
  if (!original)
    throw new ConflictException('No se encontró el comprobante automático original para reversar');
  const reversal = await tx.journalEntry.create({
    data: {
      establishmentId: input.establishmentId,
      createdById: input.userId,
      reversalOfId: original.id,
      date: new Date(),
      description: `Reverso automático #${original.number.toString()}: ${input.reason}`,
      referenceType: `${input.referenceType}_VOID`,
      referenceId: input.referenceId,
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
  });
  await tx.journalEntry.update({ where: { id: original.id }, data: { status: 'REVERSED' } });
  return reversal;
}
