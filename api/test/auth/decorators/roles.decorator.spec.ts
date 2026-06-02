import { Roles, ROLES_KEY } from '../../../src/auth/decorators/roles.decorator';

describe('Roles decorator', () => {
  it('ROLES_KEY is "roles"', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('sets metadata with ROLES_KEY on the decorated target', () => {
    @Roles('admin')
    class TestClass {}

    expect(Reflect.getMetadata(ROLES_KEY, TestClass)).toEqual(['admin']);
  });

  it('sets multiple roles when called with multiple arguments', () => {
    @Roles('admin', 'moderator')
    class TestClass {}

    expect(Reflect.getMetadata(ROLES_KEY, TestClass)).toEqual([
      'admin',
      'moderator',
    ]);
  });
});
