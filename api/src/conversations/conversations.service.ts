import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX_TOKEN } from '../database/database.providers.js';
import type { Conversation } from './entities/conversation.entity.js';
import type { ConversationMember } from './entities/member.entity.js';
import type { CreateDirectDto } from './dto/create-direct.dto.js';
import type { CreateGroupDto } from './dto/create-group.dto.js';
import type { InviteMemberDto } from './dto/invite-member.dto.js';
import type { UpdateMemberStatusDto } from './dto/update-member-status.dto.js';

@Injectable()
export class ConversationsService {
  constructor(@Inject(KNEX_TOKEN) private readonly knex: Knex) {}

  async createDirect(
    initiatorId: number,
    dto: CreateDirectDto,
  ): Promise<Conversation> {
    const existing = await this.knex<{ id: number }>(
      'conversation_members as cm1',
    )
      .join(
        'conversation_members as cm2',
        'cm1.conversation_id',
        'cm2.conversation_id',
      )
      .join('conversations as c', 'c.id', 'cm1.conversation_id')
      .where('c.type', 'direct')
      .where('cm1.user_id', initiatorId)
      .where('cm2.user_id', dto.recipientId)
      .select('c.id')
      .first<{ id: number }>();

    if (existing) {
      return this.knex<Conversation>('conversations')
        .where('id', existing.id)
        .first() as Promise<Conversation>;
    }

    return this.knex.transaction(async (trx) => {
      const [conv] = await trx<Conversation>('conversations')
        .insert({ type: 'direct', created_by: initiatorId })
        .returning('*');

      await trx('conversation_members').insert([
        {
          conversation_id: conv.id,
          user_id: initiatorId,
          role: 'member',
          status: 'accepted',
          invited_by: null,
          joined_at: this.knex.fn.now(),
        },
        {
          conversation_id: conv.id,
          user_id: dto.recipientId,
          role: 'member',
          status: 'pending',
          invited_by: initiatorId,
        },
      ]);

      return conv;
    });
  }

  async createGroup(
    ownerId: number,
    dto: CreateGroupDto,
  ): Promise<Conversation> {
    return this.knex.transaction(async (trx) => {
      const [conv] = await trx<Conversation>('conversations')
        .insert({
          type: 'group',
          name: dto.name,
          description: dto.description ?? null,
          created_by: ownerId,
        })
        .returning('*');

      await trx('conversation_members').insert({
        conversation_id: conv.id,
        user_id: ownerId,
        role: 'owner',
        status: 'accepted',
        joined_at: this.knex.fn.now(),
      });

      return conv;
    });
  }

  async findMyConversations(userId: number): Promise<Conversation[]> {
    return this.knex<Conversation>('conversations as c')
      .join('conversation_members as cm', 'cm.conversation_id', 'c.id')
      .where('cm.user_id', userId)
      .where('cm.status', 'accepted')
      .select('c.*')
      .orderBy('c.updated_at', 'desc');
  }

  async findMyRequests(userId: number): Promise<Conversation[]> {
    return this.knex<Conversation>('conversations as c')
      .join('conversation_members as cm', 'cm.conversation_id', 'c.id')
      .where('cm.user_id', userId)
      .where('cm.status', 'pending')
      .select('c.*')
      .orderBy('c.created_at', 'desc');
  }

  async findOne(conversationId: number, userId: number): Promise<Conversation> {
    await this.assertMember(conversationId, userId);
    const conv = await this.knex<Conversation>('conversations')
      .where('id', conversationId)
      .first();
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async inviteMember(
    conversationId: number,
    requesterId: number,
    dto: InviteMemberDto,
  ): Promise<ConversationMember> {
    await this.assertOwner(conversationId, requesterId);

    const [member] = await this.knex<ConversationMember>('conversation_members')
      .insert({
        conversation_id: conversationId,
        user_id: dto.userId,
        role: 'member',
        status: 'pending',
        invited_by: requesterId,
      })
      .returning('*');

    return member;
  }

  async updateMyStatus(
    conversationId: number,
    userId: number,
    dto: UpdateMemberStatusDto,
  ): Promise<ConversationMember> {
    const member = await this.knex<ConversationMember>('conversation_members')
      .where({ conversation_id: conversationId, user_id: userId })
      .first();

    if (!member) throw new NotFoundException('Membership not found');

    const patch: Partial<ConversationMember> = { status: dto.status };
    if (dto.status === 'accepted') {
      patch.joined_at = new Date();
    }

    const [updated] = await this.knex<ConversationMember>(
      'conversation_members',
    )
      .where({ conversation_id: conversationId, user_id: userId })
      .update(patch)
      .returning('*');

    return updated;
  }

  async removeMember(
    conversationId: number,
    requesterId: number,
    targetUserId: number,
  ): Promise<void> {
    await this.assertOwner(conversationId, requesterId);

    await this.knex('conversation_members')
      .where({ conversation_id: conversationId, user_id: targetUserId })
      .update({ status: 'removed' });
  }

  private async assertMember(
    conversationId: number,
    userId: number,
  ): Promise<void> {
    const member = await this.knex<{ id: number }>('conversation_members')
      .where({ conversation_id: conversationId, user_id: userId })
      .whereIn('status', ['accepted', 'pending'])
      .first<{ id: number }>();
    if (!member)
      throw new ForbiddenException('Not a member of this conversation');
  }

  private async assertOwner(
    conversationId: number,
    userId: number,
  ): Promise<void> {
    const member = await this.knex<{ id: number }>('conversation_members')
      .where({
        conversation_id: conversationId,
        user_id: userId,
        role: 'owner',
        status: 'accepted',
      })
      .first<{ id: number }>();
    if (!member) throw new ForbiddenException('Owner access required');
  }
}
