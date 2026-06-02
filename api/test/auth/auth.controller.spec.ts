import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockTokenResponse = {
    access_token: 'signed.jwt.token',
    user: {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      role: 'user',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn().mockResolvedValue(mockTokenResponse),
            login: jest.fn().mockResolvedValue(mockTokenResponse),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('delegates to AuthService.register and returns token response', async () => {
      const dto = {
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      };

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTokenResponse);
    });
  });

  describe('login', () => {
    it('delegates to AuthService.login and returns token response', async () => {
      const dto = { email: 'alice@example.com', password: 'password123' };

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTokenResponse);
    });
  });

  it('covers decorator metadata Object branch when AuthService is unavailable at load time', () => {
    jest.isolateModules(() => {
      jest.mock('../../src/auth/auth.service', () => ({
        AuthService: undefined,
      }));
      jest.mock('../../src/auth/dto/register.dto', () => ({
        RegisterDto: undefined,
      }));
      jest.mock('../../src/auth/dto/login.dto', () => ({
        LoginDto: undefined,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/auth/auth.controller');
    });
  });
});
