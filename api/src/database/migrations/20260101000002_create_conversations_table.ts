import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('conversations', (t) => {
    t.increments('id').primary();
    t.enu('type', ['direct', 'group']).notNullable();
    t.string('name', 100).nullable();
    t.text('description').nullable();
    t.string('avatar_url', 500).nullable();
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL').nullable();
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('conversations');
}
