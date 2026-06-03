#!/bin/sh
set -e

echo "→ Normalising migration filenames (ts → js in knex_migrations table)..."
node -e "
const { Client } = require('pg');
const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
client.connect()
  .then(() => client.query(\"UPDATE knex_migrations SET name = REPLACE(name, '.ts', '.js') WHERE name LIKE '%.ts'\"))
  .then(() => client.end())
  .catch(() => client.end()); // table may not exist yet on a fresh DB — that's fine
" || true

echo "→ Running database migrations..."
node ./node_modules/.bin/knex migrate:latest --knexfile dist/knexfile.js

echo "→ Starting API server..."
exec node dist/src/main
