import knex, { type Knex } from 'knex';

export const KNEX_TOKEN = 'KNEX_CONNECTION';

export const databaseProviders = [
  {
    provide: KNEX_TOKEN,
    useFactory: (): Knex => {
      const isTest = process.env.NODE_ENV === 'test';
      return knex({
        client: 'pg',
        connection: {
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          user: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: isTest
            ? (process.env.TEST_DB_NAME ?? 'chat_test')
            : (process.env.DB_NAME ?? 'chat_db'),
        },
      });
    },
  },
];
