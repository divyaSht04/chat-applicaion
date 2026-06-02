import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_TOKEN } from '../database/database.providers.js';
import type { MessageResponse } from './entities/message.entity.js';
import type { CreateMessageDto } from './dto/create-message.dto.js';
import type { MarkReadDto } from './dto/mark-read.dto.js';
import type { CursorPageDto } from './dto/cursor-page.dto.js';

const DEFAULT_LIMIT = 50;

export interface MessagePage {
  messages: MessageResponse[];
  nextCursor: number | null;
  hasMore: boolean;
}

@Injectable()
export class MessagesService {
  constructor(@Inject(KNEX_TOKEN) private readonly knex: Knex) {}

  async getMessages(
    conversationId: number,
    userId: number,
    query: CursorPageDto,
  ): Promise<MessagePage> {
    await this.assertMember(conversationId, userId);

    const limit = query.limit ?? DEFAULT_LIMIT;

    const rows = (await this.knex<MessageResponse>('messages as m')
      .join('users as u', 'u.id', 'm.sender_id')
      .leftJoin('message_reads as mr', function () {
        this.on('mr.message_id', 'm.id').andOn(
          'mr.user_id',
          '<>',
          'm.sender_id',
        );
      })
      .where('m.conversation_id', conversationId)
      .where('m.is_deleted', false)
      .modify((q) => {
        if (query.before) q.where('m.id', '<', query.before);
      })
      .groupBy('m.id', 'u.id')
      .select(
        'm.*',
        'u.username',
        'u.display_name',
        'u.avatar_url',
        this.knex.raw('COUNT(mr.user_id)::int AS read_count'),
      )
      .orderBy('m.id', 'desc')
      .limit(limit + 1)) as MessageResponse[];

    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse();
    const nextCursor = hasMore && messages.length > 0 ? messages[0].id : null;

    return { messages, nextCursor, hasMore };
  }

  async createMessage(
    conversationId: number,
    senderId: number,
    dto: CreateMessageDto,
  ): Promise<MessageResponse> {
    await this.assertMember(conversationId, senderId);

    const [msg] = (await this.knex('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: dto.content,
        content_type: 'text',
        reply_to_id: dto.replyToId ?? null,
      })
      .returning('*')) as [{ id: number }];

    await this.knex('conversations')
      .where('id', conversationId)
      .update({ updated_at: this.knex.fn.now() });

    return this.enrichMessage(msg);
  }

  async markRead(
    conversationId: number,
    userId: number,
    dto: MarkReadDto,
  ): Promise<void> {
    await this.assertMember(conversationId, userId);

    const unread = await this.knex<{ id: number }>('messages')
      .where('conversation_id', conversationId)
      .where('id', '<=', dto.lastMessageId)
      .whereNot('sender_id', userId)
      .whereNotExists(
        this.knex('message_reads').where({
          message_id: this.knex.ref('messages.id'),
          user_id: userId,
        }),
      )
      .select<{ id: number }[]>('id');

    if (unread.length === 0) return;

    await this.knex('message_reads').insert(
      unread.map((r) => ({ message_id: r.id, user_id: userId })),
    );
  }

  private async enrichMessage(msg: { id: number }): Promise<MessageResponse> {
    const [row] = (await this.knex<MessageResponse>('messages as m')
      .join('users as u', 'u.id', 'm.sender_id')
      .leftJoin('message_reads as mr', function () {
        this.on('mr.message_id', 'm.id').andOn(
          'mr.user_id',
          '<>',
          'm.sender_id',
        );
      })
      .where('m.id', msg.id)
      .groupBy('m.id', 'u.id')
      .select(
        'm.*',
        'u.username',
        'u.display_name',
        'u.avatar_url',
        this.knex.raw('COUNT(mr.user_id)::int AS read_count'),
      )) as [MessageResponse];
    return row;
  }

  private async assertMember(
    conversationId: number,
    userId: number,
  ): Promise<void> {
    const member = await this.knex<{ id: number }>('conversation_members')
      .where({
        conversation_id: conversationId,
        user_id: userId,
        status: 'accepted',
      })
      .first<{ id: number }>();
    if (!member)
      throw new ForbiddenException('Not a member of this conversation');
  }
}
