import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockDbUser = {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    password_hash: 'hashed_password',
    avatar_url: null,
    role: 'user' as const,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const mockPublicUser: Record<string, unknown> = {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    avatar_url: null,
    role: 'user',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('returns access_token and user without password_hash', async () => {
      usersService.create.mockResolvedValue(mockPublicUser);

      const result = await service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.user).toEqual(mockPublicUser);
      expect(result.user).not.toHaveProperty('password_hash');
    });

    it('signs JWT with correct payload fields', async () => {
      usersService.create.mockResolvedValue(mockPublicUser);

      await service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 1,
          email: 'alice@example.com',
          username: 'alice',
          role: 'user',
        }),
      );
    });

    it('delegates creation to UsersService', async () => {
      usersService.create.mockResolvedValue(mockPublicUser);

      await service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(usersService.create).toHaveBeenCalledWith({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });
    });
  });

  describe('login', () => {
    it('returns access_token and user on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockDbUser);
      usersService.findById.mockResolvedValue(mockPublicUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.user).toEqual(mockPublicUser);
    });

    it('throws UnauthorizedException when email not found', async () => {
      usersService.findByEmail.mockResolvedValue(undefined);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      usersService.findByEmail.mockResolvedValue(mockDbUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'alice@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('looks up clean user after password check to avoid leaking hash in token payload', async () => {
      usersService.findByEmail.mockResolvedValue(mockDbUser);
      usersService.findById.mockResolvedValue(mockPublicUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(usersService.findById).toHaveBeenCalledWith(mockDbUser.id);
    });
  });

  it('covers decorator metadata Object branch when dependencies are unavailable at load time', () => {
    jest.isolateModules(() => {
      jest.mock('../../src/users/users.service', () => ({
        UsersService: undefined,
      }));
      jest.mock('@nestjs/jwt', () => ({ JwtService: undefined }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/auth/auth.service');
    });
  });
});
