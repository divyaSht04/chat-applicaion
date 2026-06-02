import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('message_reads', (t) => {
    t.bigInteger('message_id')
      .notNullable()
      .references('id')
      .inTable('messages')
      .onDelete('CASCADE');
    t.integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    t.timestamp('read_at').defaultTo(knex.fn.now()).notNullable();

    t.primary(['message_id', 'user_id']);
  });

  // Composite PK already covers (message_id, user_id); add standalone index for COUNT queries
  await knex.schema.raw(
    'CREATE INDEX idx_message_reads_message_id ON message_reads (message_id)',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('message_reads');
}
