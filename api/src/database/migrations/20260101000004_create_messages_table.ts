import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('messages', (t) => {
    t.bigIncrements('id').primary();
    t.integer('conversation_id')
      .notNullable()
      .references('id')
      .inTable('conversations')
      .onDelete('CASCADE');
    t.integer('sender_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    t.text('content').notNullable();
    t.enu('content_type', ['text', 'system']).notNullable().defaultTo('text');
    t.bigInteger('reply_to_id').nullable();
    t.boolean('is_deleted').notNullable().defaultTo(false);
    t.timestamp('deleted_at').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  // Critical index: covers all cursor pagination queries
  await knex.schema.raw(
    'CREATE INDEX idx_messages_conv_id_desc ON messages (conversation_id, id DESC)',
  );
  await knex.schema.raw('CREATE INDEX idx_messages_sender ON messages (sender_id)');

  // Add the self-referential FK after table creation to avoid circular dependency
  await knex.schema.raw(
    'ALTER TABLE messages ADD CONSTRAINT fk_messages_reply_to FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('messages');
}
