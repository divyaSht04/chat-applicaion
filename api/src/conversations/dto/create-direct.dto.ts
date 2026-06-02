import { IsInt, IsPositive } from 'class-validator';

export class CreateDirectDto {
  @IsInt()
  @IsPositive()
  recipientId!: number;
}
