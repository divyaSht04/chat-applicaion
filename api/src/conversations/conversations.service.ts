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
import type { MessageResponse } from '../messages/entities/message.entity.js';

export interface ConversationWithDisplay extends Conversation {
  display_name: string | null;
  my_status: 'accepted' | 'pending';
  has_pending_member: boolean;
}

export interface MemberWithUser {
  id: number;
  conversation_id: number;
  user_id: number;
  role: 'owner' | 'member';
  status: string;
  username: string;
  email: string;
  avatar_url: string | null;
}
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
      // Re-activate any memberships that were previously left or removed so the
      // conversation reappears in both users' sidebars immediately
      await this.knex('conversation_members')
        .where({ conversation_id: existing.id })
        .whereIn('user_id', [initiatorId, dto.recipientId])
        .whereIn('status', ['left', 'removed'])
        .update({ status: 'accepted', joined_at: this.knex.fn.now() });

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
          joined_at: null,
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

  async findMyConversations(
    userId: number,
  ): Promise<ConversationWithDisplay[]> {
    return this.knex('conversations as c')
      .join('conversation_members as cm', 'cm.conversation_id', 'c.id')
      .where('cm.user_id', userId)
      .whereIn('cm.status', ['accepted', 'pending'])
      .select<ConversationWithDisplay[]>(
        'c.*',
        'cm.status as my_status',
        this.knex.raw(
          `CASE WHEN c.type = 'direct' THEN (
            SELECT u.username FROM conversation_members cm2
            JOIN users u ON u.id = cm2.user_id
            WHERE cm2.conversation_id = c.id AND cm2.user_id != ?
            LIMIT 1
          ) ELSE c.name END as display_name`,
          [userId],
        ),
        this.knex.raw(
          `EXISTS (
            SELECT 1 FROM conversation_members cm3
            WHERE cm3.conversation_id = c.id
              AND cm3.user_id != ?
              AND cm3.status = 'pending'
          ) as has_pending_member`,
          [userId],
        ),
      )
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

    // Upsert — handles the case where the user previously left or was removed
    const [member] = await this.knex<ConversationMember>('conversation_members')
      .insert({
        conversation_id: conversationId,
        user_id: dto.userId,
        role: 'member',
        status: 'accepted',
        invited_by: requesterId,
        joined_at: this.knex.fn.now(),
      })
      .onConflict(['conversation_id', 'user_id'])
      .merge(['role', 'status', 'invited_by', 'joined_at'])
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

  async leaveConversation(
    conversationId: number,
    userId: number,
  ): Promise<MessageResponse | null> {
    const member = await this.knex<ConversationMember>('conversation_members')
      .where({ conversation_id: conversationId, user_id: userId })
      .whereIn('status', ['accepted', 'pending'])
      .first<ConversationMember>();

    if (!member) throw new NotFoundException('Membership not found');

    await this.knex('conversation_members')
      .where({ conversation_id: conversationId, user_id: userId })
      .update({ status: 'left' });

    return this.insertGroupSystemMessage(
      conversationId,
      userId,
      'left the group',
    );
  }

  async deleteGroup(conversationId: number, userId: number): Promise<void> {
    await this.assertOwner(conversationId, userId);

    const conv = await this.knex<Conversation>('conversations')
      .where('id', conversationId)
      .first();
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.type !== 'group')
      throw new ForbiddenException('Only group conversations can be deleted');

    await this.knex('conversations').where('id', conversationId).delete();
  }

  async removeMember(
    conversationId: number,
    requesterId: number,
    targetUserId: number,
  ): Promise<MessageResponse | null> {
    await this.assertOwner(conversationId, requesterId);

    await this.knex('conversation_members')
      .where({ conversation_id: conversationId, user_id: targetUserId })
      .update({ status: 'removed' });

    return this.insertGroupSystemMessage(
      conversationId,
      targetUserId,
      'was removed from the group',
    );
  }

  async getMembers(
    conversationId: number,
    userId: number,
  ): Promise<MemberWithUser[]> {
    await this.assertMember(conversationId, userId);
    return this.knex('conversation_members as cm')
      .join('users as u', 'u.id', 'cm.user_id')
      .where('cm.conversation_id', conversationId)
      .whereIn('cm.status', ['accepted'])
      .select<
        MemberWithUser[]
      >('cm.id', 'cm.conversation_id', 'cm.user_id', 'cm.role', 'cm.status', 'u.username', 'u.email', 'u.avatar_url')
      .orderByRaw(`CASE WHEN cm.role = 'owner' THEN 0 ELSE 1 END`)
      .orderBy('cm.created_at', 'asc');
  }

  async notifyMemberJoined(
    conversationId: number,
    userId: number,
  ): Promise<MessageResponse | null> {
    return this.insertGroupSystemMessage(
      conversationId,
      userId,
      'was added to the group',
    );
  }

  private async insertGroupSystemMessage(
    conversationId: number,
    actorId: number,
    action: string,
  ): Promise<MessageResponse | null> {
    const conv = await this.knex<Conversation>('conversations')
      .where('id', conversationId)
      .first();
    if (!conv || conv.type !== 'group') return null;

    const user = await this.knex<{ username: string }>('users')
      .where('id', actorId)
      .select('username')
      .first<{ username: string }>();
    if (!user) return null;

    const [msg] = (await this.knex('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: actorId,
        content: `${user.username} ${action}`,
        content_type: 'system',
      })
      .returning('*')) as { id: number }[];

    await this.knex('conversations')
      .where('id', conversationId)
      .update({ updated_at: this.knex.fn.now() });

    const [enriched] = (await this.knex<MessageResponse>('messages as m')
      .join('users as u', 'u.id', 'm.sender_id')
      .where('m.id', msg.id)
      .select(
        'm.*',
        'u.username',
        'u.avatar_url',
        this.knex.raw('0::int AS read_count'),
      )) as [MessageResponse];

    return enriched;
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
