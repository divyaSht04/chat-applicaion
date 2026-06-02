import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../../../src/auth/guards/roles.guard';
import { ROLES_KEY } from '../../../src/auth/decorators/roles.decorator';

const makeContext = (
  role: string,
  _roles: string[] | undefined,
): ExecutionContext => {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  } as unknown as ExecutionContext;
};

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('allows access when no @Roles decorator is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeContext('user', undefined);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when user role matches required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = makeContext('admin', ['admin']);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies access when user role does not match', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = makeContext('user', ['admin']);

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('reads metadata using ROLES_KEY', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeContext('user', undefined);

    guard.canActivate(ctx);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      expect.any(Array),
    );
  });

  it('covers decorator metadata Object branch when Reflector is unavailable at load time', () => {
    jest.isolateModules(() => {
      jest.mock('@nestjs/core', () => ({ Reflector: undefined }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../../src/auth/guards/roles.guard');
    });
  });
});
