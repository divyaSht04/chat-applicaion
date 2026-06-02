import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { TokenResponseDto } from './dto/token-response.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenResponseDto> {
    const user = await this.usersService.create(dto);
    const token = this.signToken(user);
    return { access_token: token, user };
  }

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const match = await bcrypt.compare(dto.password, user.password_hash);

    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = await this.usersService.findById(user.id);
    const token = this.signToken(payload);
    return { access_token: token, user: payload };
  }

  private signToken(user: Record<string, unknown>): string {
    return this.jwtService.sign({
      sub: user['id'],
      email: user['email'],
      username: user['username'],
      role: user['role'],
    });
  }
}
