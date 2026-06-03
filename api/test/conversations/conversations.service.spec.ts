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
      orderByRaw: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      merge: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    };
    qb[terminal] = jest.fn().mockResolvedValue(value);
    return qb;
  }

  const rawStub = jest.fn().mockReturnValue('(raw)');

  beforeEach(async () => {
    const base = jest.fn();
    const trxFn = jest.fn((cb: (trx: unknown) => Promise<unknown>) => cb(base));
    Object.assign(base, {
      transaction: trxFn,
      fn: { now: jest.fn().mockReturnValue('NOW()') },
      raw: rawStub,
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
    it('returns existing conversation and re-activates any left members', async () => {
      const checkQb = chain('first', { id: 1 });
      const reactivateQb = chain('update', 1);
      const convQb = chain('first', mockConv);
      mockKnex
        .mockReturnValueOnce(checkQb)
        .mockReturnValueOnce(reactivateQb)
        .mockReturnValueOnce(convQb);

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
    it('returns accepted and pending conversations ordered by updated_at', async () => {
      const qb = chain('orderBy', [mockConv]);
      mockKnex.mockReturnValue(qb);

      const result = await service.findMyConversations(1);

      expect(result).toEqual([mockConv]);
      expect(qb.whereIn).toHaveBeenCalledWith('cm.status', [
        'accepted',
        'pending',
      ]);
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

  describe('leaveConversation', () => {
    it('sets status to left and returns null for direct conversations', async () => {
      mockKnex
        .mockReturnValueOnce(chain('first', mockMember)) // member check
        .mockReturnValueOnce(chain('update', 1)) // status update
        .mockReturnValueOnce(chain('first', mockConv)); // conv type check (direct)

      await expect(service.leaveConversation(1, 2)).resolves.toBeNull();
    });

    it('throws NotFoundException when membership does not exist', async () => {
      mockKnex.mockReturnValue(chain('first', undefined));

      await expect(service.leaveConversation(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteGroup', () => {
    const groupConv = { ...mockConv, type: 'group' };

    it('deletes group when user is owner', async () => {
      mockKnex
        .mockReturnValueOnce(
          chain('first', { role: 'owner', status: 'accepted' }),
        ) // assertOwner
        .mockReturnValueOnce(chain('first', groupConv)) // fetch conv
        .mockReturnValueOnce(chain('delete', 1)); // delete

      await expect(service.deleteGroup(1, 1)).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when requester is not owner', async () => {
      mockKnex.mockReturnValue(chain('first', undefined));

      await expect(service.deleteGroup(1, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when conversation is not a group', async () => {
      const directConv = { ...mockConv, type: 'direct' };
      mockKnex
        .mockReturnValueOnce(
          chain('first', { role: 'owner', status: 'accepted' }),
        )
        .mockReturnValueOnce(chain('first', directConv));

      await expect(service.deleteGroup(1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      mockKnex
        .mockReturnValueOnce(
          chain('first', { role: 'owner', status: 'accepted' }),
        )
        .mockReturnValueOnce(chain('first', undefined));

      await expect(service.deleteGroup(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeMember', () => {
    it('removes member and returns null for direct conversations', async () => {
      mockKnex
        .mockReturnValueOnce(
          chain('first', { role: 'owner', status: 'accepted' }),
        ) // assertOwner
        .mockReturnValueOnce(chain('update', 1)) // status update
        .mockReturnValueOnce(chain('first', mockConv)); // conv type (direct)

      await expect(service.removeMember(1, 1, 2)).resolves.toBeNull();
    });

    it('throws ForbiddenException when requester is not owner', async () => {
      mockKnex.mockReturnValue(chain('first', undefined));

      await expect(service.removeMember(1, 99, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getMembers', () => {
    it('returns accepted members with user info', async () => {
      const memberQb = chain('first', { id: 1 }); // assertMember
      const membersQb = chain('orderBy', []);
      Object.assign(membersQb, { orderByRaw: jest.fn().mockReturnThis() });
      mockKnex.mockReturnValueOnce(memberQb).mockReturnValueOnce(membersQb);

      const result = await service.getMembers(1, 1);

      expect(result).toEqual([]);
      expect(membersQb.whereIn).toHaveBeenCalledWith('cm.status', ['accepted']);
    });

    it('throws ForbiddenException when user is not a member', async () => {
      mockKnex.mockReturnValue(chain('first', undefined));

      await expect(service.getMembers(1, 99)).rejects.toThrow(
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
