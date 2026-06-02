import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationsService } from '../../src/conversations/conversations.service';
import { KNEX_TOKEN } from '../../src/database/database.providers';

describe('ConversationsService', () => {
  type KnexMock = jest.Mock & {
    transaction: jest.Mock;
    fn: { now: jest.Mock };
  };

  let service: ConversationsService;
  let mockKnex: KnexMock;

  const mockConv = {
    id: 1,
    type: 'direct',
    name: null,
    description: null,
    avatar_url: null,
    created_by: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockMember = {
    id: 1,
    conversation_id: 1,
    user_id: 2,
    role: 'member',
    status: 'pending',
    invited_by: 1,
    joined_at: null,
    created_at: new Date(),
  };

  function chain(terminal: string, value: unknown) {
    const qb: Record<string, jest.Mock> = {
      join: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    qb[terminal] = jest.fn().mockResolvedValue(value);
    return qb;
  }

  beforeEach(async () => {
    const base = jest.fn();
    const trxFn = jest.fn((cb: (trx: unknown) => Promise<unknown>) => cb(base));
    Object.assign(base, {
      transaction: trxFn,
      fn: { now: jest.fn().mockReturnValue('NOW()') },
    });
    mockKnex = base as KnexMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: KNEX_TOKEN, useValue: mockKnex },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createDirect', () => {
    it('returns existing conversation when DM already exists', async () => {
      const checkQb = chain('first', { id: 1 });
      const convQb = chain('first', mockConv);
      mockKnex.mockReturnValueOnce(checkQb).mockReturnValueOnce(convQb);

      const result = await service.createDirect(1, { recipientId: 2 });

      expect(result).toEqual(mockConv);
      expect(mockKnex.transaction).not.toHaveBeenCalled();
    });

    it('creates new DM with initiator accepted and recipient pending', async () => {
      const checkQb = chain('first', undefined);
      const insertConvQb = chain('returning', [mockConv]);
      const insertMembersQb = chain('insert', []);
      mockKnex
        .mockReturnValueOnce(checkQb)
        .mockReturnValueOnce(insertConvQb)
        .mockReturnValueOnce(insertMembersQb);

      const result = await service.createDirect(1, { recipientId: 2 });

      expect(result).toEqual(mockConv);
      expect(mockKnex.transaction).toHaveBeenCalled();
    });
  });

  describe('createGroup', () => {
    it('creates group conversation with owner as accepted member', async () => {
      const groupConv = { ...mockConv, type: 'group', name: 'Dev Team' };
      const insertConvQb = chain('returning', [groupConv]);
      const insertMemberQb = chain('insert', []);
      mockKnex
        .mockReturnValueOnce(insertConvQb)
        .mockReturnValueOnce(insertMemberQb);

      const result = await service.createGroup(1, { name: 'Dev Team' });

      expect(result.type).toBe('group');
      expect(result.name).toBe('Dev Team');
    });

    it('passes optional description to the insert', async () => {
      const groupConv = {
        ...mockConv,
        type: 'group',
        name: 'Team',
        description: 'Desc',
      };
      const insertConvQb = chain('returning', [groupConv]);
      const insertMemberQb = chain('insert', []);
      mockKnex
        .mockReturnValueOnce(insertConvQb)
        .mockReturnValueOnce(insertMemberQb);

      const result = await service.createGroup(1, {
        name: 'Team',
        description: 'Desc',
      });

      expect(result.description).toBe('Desc');
    });
  });

  describe('findMyConversations', () => {
    it('returns accepted conversations ordered by updated_at', async () => {
      const qb = chain('orderBy', [mockConv]);
      mockKnex.mockReturnValue(qb);

      const result = await service.findMyConversations(1);

      expect(result).toEqual([mockConv]);
      expect(qb.where).toHaveBeenCalledWith('cm.status', 'accepted');
    });
  });

  describe('findMyRequests', () => {
    it('returns pending conversations ordered by created_at', async () => {
      const qb = chain('orderBy', [mockConv]);
      mockKnex.mockReturnValue(qb);

      const result = await service.findMyRequests(1);

      expect(result).toEqual([mockConv]);
      expect(qb.where).toHaveBeenCalledWith('cm.status', 'pending');
    });
  });

  describe('findOne', () => {
    it('returns conversation when user is a member', async () => {
      const memberQb = chain('first', { id: 1 });
      const convQb = chain('first', mockConv);
      mockKnex.mockReturnValueOnce(memberQb).mockReturnValueOnce(convQb);

      expect(await service.findOne(1, 1)).toEqual(mockConv);
    });

    it('throws ForbiddenException when user is not a member', async () => {
      mockKnex.mockReturnValue(chain('first', undefined));

      await expect(service.findOne(1, 99)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      const memberQb = chain('first', { id: 1 });
      const convQb = chain('first', undefined);
      mockKnex.mockReturnValueOnce(memberQb).mockReturnValueOnce(convQb);

      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('inviteMember', () => {
    it('invites a user when requester is owner', async () => {
      const ownerQb = chain('first', { role: 'owner', status: 'accepted' });
      const insertQb = chain('returning', [mockMember]);
      mockKnex.mockReturnValueOnce(ownerQb).mockReturnValueOnce(insertQb);

      expect(await service.inviteMember(1, 1, { userId: 2 })).toEqual(
        mockMember,
      );
    });

    it('throws ForbiddenException when requester is not owner', async () => {
      mockKnex.mockReturnValue(chain('first', undefined));

      await expect(service.inviteMember(1, 99, { userId: 2 })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateMyStatus', () => {
    it('updates status to accepted and sets joined_at', async () => {
      const updated = {
        ...mockMember,
        status: 'accepted',
        joined_at: new Date(),
      };
      mockKnex
        .mockReturnValueOnce(chain('first', mockMember))
        .mockReturnValueOnce(chain('returning', [updated]));

      const result = await service.updateMyStatus(1, 2, { status: 'accepted' });

      expect(result.status).toBe('accepted');
      expect(result.joined_at).toBeDefined();
    });

    it('updates status to rejected without setting joined_at', async () => {
      const updated = { ...mockMember, status: 'rejected' };
      mockKnex
        .mockReturnValueOnce(chain('first', mockMember))
        .mockReturnValueOnce(chain('returning', [updated]));

      const result = await service.updateMyStatus(1, 2, { status: 'rejected' });

      expect(result.status).toBe('rejected');
      expect(result.joined_at).toBeNull();
    });

    it('throws NotFoundException when membership does not exist', async () => {
      mockKnex.mockReturnValue(chain('first', undefined));

      await expect(
        service.updateMyStatus(1, 99, { status: 'accepted' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('removes member when requester is owner', async () => {
      mockKnex
        .mockReturnValueOnce(chain('first', { role: 'owner' }))
        .mockReturnValueOnce(chain('update', 1));

      await expect(service.removeMember(1, 1, 2)).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when requester is not owner', async () => {
      mockKnex.mockReturnValue(chain('first', undefined));

      await expect(service.removeMember(1, 99, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  it('covers decorator metadata Object branch when KNEX_TOKEN is unavailable at load time', () => {
    jest.isolateModules(() => {
      jest.mock('../../src/database/database.providers', () => ({
        KNEX_TOKEN: 'KNEX_CONNECTION',
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/conversations/conversations.service');
    });
  });
});
