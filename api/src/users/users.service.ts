import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Knex } from 'knex';
import * as bcrypt from 'bcrypt';
import { KNEX_TOKEN } from '../database/database.providers.js';
import type { User } from './entities/user.entity.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import { instanceToPlain } from 'class-transformer';

@Injectable()
export class UsersService {
  constructor(@Inject(KNEX_TOKEN) private readonly knex: Knex) {}

  async create(dto: CreateUserDto): Promise<Record<string, unknown>> {
    const existing = await this.knex('users')
      .where('email', dto.email)
      .orWhere('username', dto.username)
      .first<User>();

    if (existing) {
      const field = existing.email === dto.email ? 'email' : 'username';
      throw new ConflictException(`${field} already taken`);
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    const [user] = await this.knex('users')
      .insert({ username: dto.username, email: dto.email, password_hash })
      .returning<
        User[]
      >(['id', 'username', 'email', 'avatar_url', 'role', 'created_at', 'updated_at']);

    return instanceToPlain(new UserResponseDto(user), {
      excludeExtraneousValues: true,
    });
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.knex('users').where('email', email).first<User>();
  }

  async findById(id: number): Promise<Record<string, unknown>> {
    const user = await this.knex('users')
      .where('id', id)
      .select<
        User[]
      >(['id', 'username', 'email', 'avatar_url', 'role', 'created_at', 'updated_at'])
      .first();

    if (!user) throw new NotFoundException('User not found');

    return instanceToPlain(new UserResponseDto(user), {
      excludeExtraneousValues: true,
    });
  }

  async searchByUsername(
    q: string,
    excludeId: number,
  ): Promise<Record<string, unknown>[]> {
    const users = await this.knex('users')
      .whereILike('username', `${q}%`)
      .andWhereNot('id', excludeId)
      .select<User[]>(['id', 'username', 'email', 'avatar_url', 'role'])
      .limit(10);

    return users.map((u) =>
      instanceToPlain(new UserResponseDto(u), {
        excludeExtraneousValues: true,
      }),
    );
  }
}
