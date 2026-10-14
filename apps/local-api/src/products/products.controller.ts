import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionCode } from '@farmacore/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateProductDto, ProductQueryDto } from './product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}
  @Get() @RequirePermissions(PermissionCode.PRODUCTS_READ) list(
    @CurrentUser() user: RequestUser,
    @Query() query: ProductQueryDto,
  ) {
    return this.products.list(user, query);
  }
  @Get(':id') @RequirePermissions(PermissionCode.PRODUCTS_READ) findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.products.findOne(user, id);
  }
  @Post() @RequirePermissions(PermissionCode.PRODUCTS_CREATE) create(
    @CurrentUser() user: RequestUser,
    @Body() input: CreateProductDto,
  ) {
    return this.products.create(user, input);
  }
}
