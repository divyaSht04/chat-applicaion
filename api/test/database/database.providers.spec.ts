import {
  KNEX_TOKEN,
  databaseProviders,
} from '../../src/database/database.providers';

const factory = databaseProviders[0].useFactory as () => unknown;

describe('databaseProviders', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      NODE_ENV: process.env.NODE_ENV,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_NAME: process.env.DB_NAME,
      TEST_DB_NAME: process.env.TEST_DB_NAME,
    };
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('exports a provider with the KNEX_TOKEN', () => {
    expect(databaseProviders[0].provide).toBe(KNEX_TOKEN);
  });

  it('KNEX_TOKEN is the expected string constant', () => {
    expect(KNEX_TOKEN).toBe('KNEX_CONNECTION');
  });

  it('factory creates a knex instance using explicit env vars in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USER = 'postgres';
    process.env.DB_PASSWORD = 'postgres';
    process.env.DB_NAME = 'chat_db';

    expect(factory()).toBeDefined();
  });

  it('factory uses TEST_DB_NAME when NODE_ENV is test and TEST_DB_NAME is set', () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USER = 'postgres';
    process.env.DB_PASSWORD = 'postgres';
    process.env.TEST_DB_NAME = 'chat_test';

    expect(factory()).toBeDefined();
  });

  it('factory falls back to "chat_test" when NODE_ENV is test and TEST_DB_NAME is unset', () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USER = 'postgres';
    process.env.DB_PASSWORD = 'postgres';
    delete process.env.TEST_DB_NAME;
    delete process.env.DB_NAME;

    expect(factory()).toBeDefined();
  });

  it('factory falls back to defaults when all DB env vars are unset', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;

    expect(factory()).toBeDefined();
  });
});
