import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Max } from 'class-validator';

export class CursorPageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  before?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  limit?: number;
}
