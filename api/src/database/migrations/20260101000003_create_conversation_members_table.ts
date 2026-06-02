import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('conversation_members', (t) => {
    t.increments('id').primary();
    t.integer('conversation_id')
      .notNullable()
      .references('id')
      .inTable('conversations')
      .onDelete('CASCADE');
    t.integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    t.enu('role', ['owner', 'member']).notNullable().defaultTo('member');
    t.enu('status', ['pending', 'accepted', 'rejected', 'left', 'removed'])
      .notNullable()
      .defaultTo('pending');
    t.integer('invited_by').references('id').inTable('users').onDelete('SET NULL').nullable();
    t.timestamp('joined_at').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    t.unique(['conversation_id', 'user_id']);
  });

  await knex.schema.raw(
    'CREATE INDEX idx_conversation_members_user_status ON conversation_members (user_id, status)',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_conversation_members_conv_status ON conversation_members (conversation_id, status)',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('conversation_members');
}
