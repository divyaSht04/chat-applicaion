import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MessagesService } from '../../src/messages/messages.service';
import { KNEX_TOKEN } from '../../src/database/database.providers';

describe('MessagesService', () => {
  type KnexMock = jest.Mock & {
    raw: jest.Mock;
    ref: jest.Mock;
    fn: { now: jest.Mock };
  };

  let service: MessagesService;
  let mockKnex: KnexMock;

  const mockMsg = {
    id: 10,
    conversation_id: 1,
    sender_id: 1,
    content: 'hello',
    content_type: 'text',
    reply_to_id: null,
    is_deleted: false,
    deleted_at: null,
    created_at: new Date(),
    username: 'alice',
    display_name: null,
    avatar_url: null,
    read_count: 0,
  };

  // Build a chainable query builder with one terminal method returning a Promise
  function chain(terminal: string, value: unknown) {
    const qb: Record<string, jest.Mock> = {
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      andOn: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      whereNotExists: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    // capture qb for modify's closure — avoids 'this' implicit-any
    qb['modify'] = jest
      .fn()
      .mockImplementation((cb: (q: Record<string, jest.Mock>) => void) => {
        cb(qb);
        return qb;
      });
    qb[terminal] = jest.fn().mockResolvedValue(value);
    return qb;
  }

  beforeEach(async () => {
    const base = jest.fn();
    Object.assign(base, {
      raw: jest.fn().mockReturnValue('raw_expr'),
      ref: jest.fn().mockReturnValue('ref_expr'),
      fn: { now: jest.fn().mockReturnValue('NOW()') },
    });
    mockKnex = base as KnexMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesService, { provide: KNEX_TOKEN, useValue: mockKnex }],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getMessages ───────────────────────────────────────────────────────────
  describe('getMessages', () => {
    it('returns messages page with hasMore false when under limit', async () => {
      const memberQb = chain('first', { id: 1 });
      const msgsQb = chain('limit', [mockMsg]);
      mockKnex.mockReturnValueOnce(memberQb).mockReturnValueOnce(msgsQb);

      const result = await service.getMessages(1, 1, {});

      expect(result.messages).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('returns hasMore true and nextCursor when results exceed limit', async () => {
      const memberQb = chain('first', { id: 1 });
      const msgs = Array.from({ length: 51 }, (_, i) => ({
        ...mockMsg,
        id: 51 - i,
      }));
      const msgsQb = chain('limit', msgs);
      mockKnex.mockReturnValueOnce(memberQb).mockReturnValueOnce(msgsQb);

      const result = await service.getMessages(1, 1, { limit: 50 });

      expect(result.hasMore).toBe(true);
      expect(result.messages).toHaveLength(50);
      expect(result.nextCursor).toBe(result.messages[0].id);
    });

    it('applies the before cursor via modify callback', async () => {
      const memberQb = chain('first', { id: 1 });
      const msgsQb = chain('limit', []);
      mockKnex.mockReturnValueOnce(memberQb).mockReturnValueOnce(msgsQb);

      await service.getMessages(1, 1, { before: 100 });

      // modify was called and, because before=100, called where on the qb
      expect(msgsQb.where).toHaveBeenCalledWith('m.id', '<', 100);
    });

    it('throws ForbiddenException when user is not an accepted member', async () => {
      const memberQb = chain('first', undefined);
      mockKnex.mockReturnValue(memberQb);

      await expect(service.getMessages(1, 99, {})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── createMessage ─────────────────────────────────────────────────────────
  describe('createMessage', () => {
    it('inserts message and returns enriched response', async () => {
      const memberQb = chain('first', { id: 1 });
      const insertQb = chain('returning', [{ id: 10 }]);
      const updateQb = chain('update', 1);
      const enrichQb = chain('select', [mockMsg]);
      mockKnex
        .mockReturnValueOnce(memberQb)
        .mockReturnValueOnce(insertQb)
        .mockReturnValueOnce(updateQb)
        .mockReturnValueOnce(enrichQb);

      const result = await service.createMessage(1, 1, { content: 'hello' });

      expect(result).toEqual(mockMsg);
    });

    it('passes replyToId when provided', async () => {
      const memberQb = chain('first', { id: 1 });
      const insertQb = chain('returning', [{ id: 10 }]);
      const updateQb = chain('update', 1);
      const enrichQb = chain('select', [mockMsg]);
      mockKnex
        .mockReturnValueOnce(memberQb)
        .mockReturnValueOnce(insertQb)
        .mockReturnValueOnce(updateQb)
        .mockReturnValueOnce(enrichQb);

      await service.createMessage(1, 1, { content: 'reply', replyToId: 5 });

      expect(insertQb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ reply_to_id: 5 }),
      );
    });

    it('throws ForbiddenException when user is not a member', async () => {
      const memberQb = chain('first', undefined);
      mockKnex.mockReturnValue(memberQb);

      await expect(
        service.createMessage(1, 99, { content: 'hello' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── markRead ──────────────────────────────────────────────────────────────
  describe('markRead', () => {
    it('inserts read receipts for unread messages', async () => {
      const memberQb = chain('first', { id: 1 });
      // knex call order: (1) 'messages' main query, (2) 'message_reads' sub-query (whereNotExists arg)
      const unreadQb = chain('select', [{ id: 5 }, { id: 8 }]);
      const subQb = chain('where', {});
      const insertQb = chain('insert', []);
      mockKnex
        .mockReturnValueOnce(memberQb) // assertMember
        .mockReturnValueOnce(unreadQb) // messages main query
        .mockReturnValueOnce(subQb) // message_reads sub-query (whereNotExists arg)
        .mockReturnValueOnce(insertQb); // message_reads insert

      await service.markRead(1, 2, { lastMessageId: 10 });

      expect(insertQb.insert).toHaveBeenCalledWith([
        { message_id: 5, user_id: 2 },
        { message_id: 8, user_id: 2 },
      ]);
    });

    it('skips insert when there are no unread messages', async () => {
      const memberQb = chain('first', { id: 1 });
      const unreadQb = chain('select', []);
      const subQb = chain('where', {});
      mockKnex
        .mockReturnValueOnce(memberQb)
        .mockReturnValueOnce(unreadQb)
        .mockReturnValueOnce(subQb);

      await service.markRead(1, 2, { lastMessageId: 10 });

      // Only 3 knex calls — no 4th call for insert
      expect(mockKnex).toHaveBeenCalledTimes(3);
    });

    it('throws ForbiddenException when user is not a member', async () => {
      const memberQb = chain('first', undefined);
      mockKnex.mockReturnValue(memberQb);

      await expect(
        service.markRead(1, 99, { lastMessageId: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it('covers decorator metadata Object branch when KNEX_TOKEN is unavailable at load time', () => {
    jest.isolateModules(() => {
      jest.mock('../../src/database/database.providers', () => ({
        KNEX_TOKEN: 'KNEX_CONNECTION',
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/messages/messages.service');
    });
  });
});
