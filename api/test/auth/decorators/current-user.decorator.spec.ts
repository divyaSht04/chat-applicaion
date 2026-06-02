import { ExecutionContext } from '@nestjs/common';
import { CurrentUser } from '../../../src/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../../src/auth/strategies/jwt.strategy';

// NestJS stores param decorator factories under this metadata key
const ROUTE_ARGS_METADATA = '__routeArguments__';

describe('CurrentUser decorator', () => {
  it('extracts user from HTTP request context', () => {
    const mockUser: JwtPayload = {
      sub: 1,
      email: 'a@a.com',
      username: 'alice',
      role: 'user',
    };
    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    } as unknown as ExecutionContext;

    class TestController {
      handler(@CurrentUser() _user: JwtPayload) {
        return _user;
      }
    }

    const meta = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TestController,
      'handler',
    ) as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => JwtPayload }
    >;
    const factory = Object.values(meta)[0].factory;

    expect(factory(undefined, mockCtx)).toEqual(mockUser);
  });

  it('returns whichever user is on the request', () => {
    const admin: JwtPayload = {
      sub: 2,
      email: 'admin@a.com',
      username: 'admin',
      role: 'admin',
    };
    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: admin }),
      }),
    } as unknown as ExecutionContext;

    class TestController {
      handler(@CurrentUser() _user: JwtPayload) {
        return _user;
      }
    }

    const meta = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TestController,
      'handler',
    ) as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => JwtPayload }
    >;

    expect(Object.values(meta)[0].factory(undefined, mockCtx)).toEqual(admin);
  });
});
