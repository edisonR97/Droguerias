import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../auth/auth.types';
import type { CreateProductDto, ProductQueryDto } from './product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: RequestUser, input: CreateProductDto) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: input.categoryId, establishmentId: user.establishmentId, active: true },
    });
    if (!category) throw new NotFoundException('Categoría inexistente o inactiva');
    if (
      input.laboratoryId &&
      !(await this.prisma.laboratory.findFirst({
        where: { id: input.laboratoryId, establishmentId: user.establishmentId, active: true },
      }))
    )
      throw new NotFoundException('Laboratorio inexistente o inactivo');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            ...input,
            establishmentId: user.establishmentId,
            internalCode: input.internalCode.trim().toUpperCase(),
            barcode: input.barcode?.trim() || null,
            commercialName: input.commercialName.trim(),
            unitsPerPurchase: new Prisma.Decimal(input.unitsPerPurchase),
            salePrice: new Prisma.Decimal(input.salePrice),
            taxRate: new Prisma.Decimal(input.taxRate),
            minimumStock: new Prisma.Decimal(input.minimumStock),
            maximumStock:
              input.maximumStock === undefined ? null : new Prisma.Decimal(input.maximumStock),
          },
          include: { category: true, laboratory: true },
        });
        await tx.auditLog.create({
          data: {
            establishmentId: user.establishmentId,
            userId: user.id,
            action: 'product.create',
            entityType: 'Product',
            entityId: product.id,
            outcome: 'SUCCESS',
          },
        });
        return product;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('El código interno o código de barras ya existe');
      throw error;
    }
  }

  async list(user: RequestUser, query: ProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      establishmentId: user.establishmentId,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { commercialName: { contains: query.search, mode: 'insensitive' } },
              { genericName: { contains: query.search, mode: 'insensitive' } },
              { activeIngredient: { contains: query.search, mode: 'insensitive' } },
              { barcode: { equals: query.search } },
              { internalCode: { equals: query.search.toUpperCase() } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: true, laboratory: true, branchInventory: true },
        orderBy: { commercialName: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(user: RequestUser, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, establishmentId: user.establishmentId },
      include: {
        category: true,
        laboratory: true,
        branchInventory: { include: { branch: true } },
        batches: { orderBy: { expiresAt: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }
}
