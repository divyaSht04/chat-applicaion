import { IsInt, IsPositive } from 'class-validator';

export class InviteMemberDto {
  @IsInt()
  @IsPositive()
  userId!: number;
}
