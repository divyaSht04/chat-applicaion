import { Expose } from 'class-transformer';
import type { User } from '../entities/user.entity.js';

export class UserResponseDto {
  @Expose() id!: number;
  @Expose() username!: string;
  @Expose() email!: string;
  @Expose() avatar_url!: string | null;
  @Expose() role!: string;
  @Expose() created_at!: Date;
  @Expose() updated_at!: Date;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
