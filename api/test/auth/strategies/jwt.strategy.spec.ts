import { JwtStrategy } from '../../../src/auth/strategies/jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let savedSecret: string | undefined;

  beforeEach(() => {
    savedSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret';
    strategy = new JwtStrategy();
  });

  afterEach(() => {
    if (savedSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = savedSecret;
    }
  });

  describe('validate', () => {
    it('returns the full payload as-is (becomes req.user)', () => {
      const payload = {
        sub: 1,
        email: 'alice@example.com',
        username: 'alice',
        role: 'user',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual(payload);
    });

    it('preserves the role field (required by RolesGuard)', () => {
      const payload = {
        sub: 2,
        email: 'admin@example.com',
        username: 'admin',
        role: 'admin',
      };

      const result = strategy.validate(payload);

      expect(result.role).toBe('admin');
    });
  });

  describe('constructor', () => {
    it('uses fallback secret when JWT_SECRET env var is not set', () => {
      delete process.env.JWT_SECRET;

      expect(() => new JwtStrategy()).not.toThrow();
    });
  });
});
