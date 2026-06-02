import { IsIn } from 'class-validator';

export class UpdateMemberStatusDto {
  @IsIn(['accepted', 'rejected', 'left'])
  status!: 'accepted' | 'rejected' | 'left';
}
