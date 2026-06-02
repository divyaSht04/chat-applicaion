import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../src/users/users.service';
import { KNEX_TOKEN } from '../../src/database/database.providers';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let mockKnex: jest.Mock;

  const mockUser = {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    password_hash: 'hashed_password',
    avatar_url: null,
    role: 'user' as const,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    mockKnex = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: KNEX_TOKEN, useValue: mockKnex }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('hashes password, inserts user, returns response without password_hash', async () => {
      const checkQb = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };
      const insertQb = {
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUser]),
      };
      mockKnex.mockReturnValueOnce(checkQb).mockReturnValueOnce(insertQb);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      const result = await service.create({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(result).toMatchObject({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
      });
      expect(result).not.toHaveProperty('password_hash');
    });

    it('throws ConflictException when email already exists', async () => {
      const checkQb = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUser),
      };
      mockKnex.mockReturnValue(checkQb);

      await expect(
        service.create({
          username: 'alice2',
          email: 'alice@example.com',
          password: 'pass1234',
        }),
      ).rejects.toThrow(new ConflictException('email already taken'));
    });

    it('throws ConflictException when username already exists', async () => {
      const checkQb = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        first: jest
          .fn()
          .mockResolvedValue({ ...mockUser, email: 'other@example.com' }),
      };
      mockKnex.mockReturnValue(checkQb);

      await expect(
        service.create({
          username: 'alice',
          email: 'new@example.com',
          password: 'pass1234',
        }),
      ).rejects.toThrow(new ConflictException('username already taken'));
    });
  });

  describe('findByEmail', () => {
    it('returns full user record including password_hash', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUser),
      };
      mockKnex.mockReturnValue(qb);

      const result = await service.findByEmail('alice@example.com');

      expect(result).toEqual(mockUser);
      expect(result?.password_hash).toBe('hashed_password');
    });

    it('returns undefined when email not found', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };
      mockKnex.mockReturnValue(qb);

      const result = await service.findByEmail('nobody@example.com');
      expect(result).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('returns user response without password_hash', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUser),
      };
      mockKnex.mockReturnValue(qb);

      const result = await service.findById(1);

      expect(result).toMatchObject({ id: 1, username: 'alice' });
      expect(result).not.toHaveProperty('password_hash');
    });

    it('throws NotFoundException when id does not exist', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined),
      };
      mockKnex.mockReturnValue(qb);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchByUsername', () => {
    it('returns matching users stripped of password_hash', async () => {
      const bob = {
        ...mockUser,
        id: 2,
        username: 'bob',
        email: 'bob@example.com',
      };
      const qb = {
        whereILike: jest.fn().mockReturnThis(),
        andWhereNot: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([bob]),
      };
      mockKnex.mockReturnValue(qb);

      const result = await service.searchByUsername('bo', 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ username: 'bob' });
      expect(result[0]).not.toHaveProperty('password_hash');
      expect(qb.whereILike).toHaveBeenCalledWith('username', 'bo%');
      expect(qb.andWhereNot).toHaveBeenCalledWith('id', 1);
    });

    it('returns empty array when nothing matches', async () => {
      const qb = {
        whereILike: jest.fn().mockReturnThis(),
        andWhereNot: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      mockKnex.mockReturnValue(qb);

      const result = await service.searchByUsername('xyz', 1);
      expect(result).toHaveLength(0);
    });
  });
});
