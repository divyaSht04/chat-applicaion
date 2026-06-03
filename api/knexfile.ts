import type { Knex } from 'knex';

const base: Knex.Config = {
  client: 'pg',
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts',
    loadExtensions: ['.ts'],
  },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...base,
    connection: {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'chat_db',
    },
  },
  test: {
    ...base,
    connection: {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.TEST_DB_NAME ?? 'chat_test',
    },
  },
  production: {
    // Don't spread `base` — override migrations to use compiled JS in dist/
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: {
      // Knex chdirs into the knexfile's folder (/app/dist/) before resolving paths,
      // so ./src/... resolves correctly to /app/dist/src/database/migrations/
      directory: './src/database/migrations',
      loadExtensions: ['.js'],
    },
  },
};

export default config;
