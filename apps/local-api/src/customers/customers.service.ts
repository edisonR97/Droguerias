import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCustomerDto } from './customer.dto';

export function validateCustomerPayload(
  input: Pick<CreateCustomerDto, 'documentType' | 'documentNumber' | 'name'>,
) {
  const documentType = input.documentType.trim().toUpperCase();
  const validDocumentTypes = new Set(['CC', 'NIT', 'CE', 'TI', 'RC', 'PP']);
  if (!validDocumentTypes.has(documentType))
    throw new BadRequestException('Tipo de documento inválido');

  const documentNumber = input.documentNumber.trim();
  if (!documentNumber) throw new BadRequestException('Número de documento requerido');

  const name = input.name.trim();
  if (name.length < 2) throw new BadRequestException('El nombre del cliente es obligatorio');

  return {
    documentType,
    documentNumber,
    name,
  };
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}
  list(user: RequestUser, search = '') {
    return this.prisma.customer.findMany({
      where: {
        establishmentId: user.establishmentId,
        active: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { documentNumber: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 50,
    });
  }
  async create(user: RequestUser, input: CreateCustomerDto) {
    const normalized = validateCustomerPayload(input);
    try {
      return await this.prisma.customer.create({
        data: {
          ...input,
          establishmentId: user.establishmentId,
          documentType: normalized.documentType,
          documentNumber: normalized.documentNumber,
          name: normalized.name,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('El cliente ya existe');
      throw error;
    }
  }
}
