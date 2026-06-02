import { IsInt, IsPositive } from 'class-validator';

export class MarkReadDto {
  @IsInt()
  @IsPositive()
  lastMessageId!: number;
}
