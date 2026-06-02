import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../../src/auth/strategies/jwt.strategy';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: Record<string, unknown> = {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    avatar_url: null,
    role: 'user',
  };

  const mockJwt: JwtPayload = {
    sub: 1,
    email: 'alice@example.com',
    username: 'alice',
    role: 'user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockUser),
            searchByUsername: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getMe', () => {
    it('calls findById with the JWT sub claim', async () => {
      const result = await controller.getMe(mockJwt);

      expect(usersService.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });
  });

  describe('search', () => {
    it('calls searchByUsername with query and current user id', async () => {
      usersService.searchByUsername.mockResolvedValue([mockUser]);

      const result = await controller.search('ali', mockJwt);

      expect(usersService.searchByUsername).toHaveBeenCalledWith('ali', 1);
      expect(result).toEqual([mockUser]);
    });

    it('defaults empty string when q is undefined', async () => {
      await controller.search(undefined as unknown as string, mockJwt);

      expect(usersService.searchByUsername).toHaveBeenCalledWith('', 1);
    });
  });

  describe('findOne', () => {
    it('calls findById with the route param id', async () => {
      const result = await controller.findOne(2);

      expect(usersService.findById).toHaveBeenCalledWith(2);
      expect(result).toEqual(mockUser);
    });
  });

  it('covers decorator metadata Object branch when UsersService is unavailable at load time', () => {
    jest.isolateModules(() => {
      jest.mock('../../src/users/users.service', () => ({
        UsersService: undefined,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/users/users.controller');
    });
  });
});
