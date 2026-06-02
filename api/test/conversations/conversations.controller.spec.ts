import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from '../../src/conversations/conversations.controller';
import { ConversationsService } from '../../src/conversations/conversations.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../../src/auth/strategies/jwt.strategy';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let service: jest.Mocked<ConversationsService>;

  const mockUser: JwtPayload = {
    sub: 1,
    email: 'a@a.com',
    username: 'alice',
    role: 'user',
  };

  const mockConv = {
    id: 1,
    type: 'direct' as const,
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
    role: 'member' as const,
    status: 'pending' as const,
    invited_by: 1,
    joined_at: null,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: ConversationsService,
          useValue: {
            createDirect: jest.fn().mockResolvedValue(mockConv),
            createGroup: jest
              .fn()
              .mockResolvedValue({ ...mockConv, type: 'group' }),
            findMyConversations: jest.fn().mockResolvedValue([mockConv]),
            findMyRequests: jest.fn().mockResolvedValue([mockConv]),
            findOne: jest.fn().mockResolvedValue(mockConv),
            inviteMember: jest.fn().mockResolvedValue(mockMember),
            updateMyStatus: jest
              .fn()
              .mockResolvedValue({ ...mockMember, status: 'accepted' }),
            removeMember: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ConversationsController>(ConversationsController);
    service = module.get(ConversationsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('createDirect delegates to service', async () => {
    const result = await controller.createDirect(mockUser, { recipientId: 2 });
    expect(service.createDirect).toHaveBeenCalledWith(1, { recipientId: 2 });
    expect(result).toEqual(mockConv);
  });

  it('createGroup delegates to service', async () => {
    const result = await controller.createGroup(mockUser, { name: 'Dev Team' });
    expect(service.createGroup).toHaveBeenCalledWith(1, { name: 'Dev Team' });
    expect(result.type).toBe('group');
  });

  it('findMyConversations delegates to service', async () => {
    const result = await controller.findMyConversations(mockUser);
    expect(service.findMyConversations).toHaveBeenCalledWith(1);
    expect(result).toEqual([mockConv]);
  });

  it('findMyRequests delegates to service', async () => {
    const result = await controller.findMyRequests(mockUser);
    expect(service.findMyRequests).toHaveBeenCalledWith(1);
    expect(result).toEqual([mockConv]);
  });

  it('findOne delegates to service with conversation id and user id', async () => {
    const result = await controller.findOne(1, mockUser);
    expect(service.findOne).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual(mockConv);
  });

  it('inviteMember delegates to service', async () => {
    const result = await controller.inviteMember(1, mockUser, { userId: 2 });
    expect(service.inviteMember).toHaveBeenCalledWith(1, 1, { userId: 2 });
    expect(result).toEqual(mockMember);
  });

  it('updateMyStatus delegates to service', async () => {
    const result = await controller.updateMyStatus(1, mockUser, {
      status: 'accepted',
    });
    expect(service.updateMyStatus).toHaveBeenCalledWith(1, 1, {
      status: 'accepted',
    });
    expect(result.status).toBe('accepted');
  });

  it('removeMember delegates to service', async () => {
    await controller.removeMember(1, 2, mockUser);
    expect(service.removeMember).toHaveBeenCalledWith(1, 1, 2);
  });

  it('covers decorator metadata Object branch when dependencies are unavailable at load time', () => {
    jest.isolateModules(() => {
      jest.mock('../../src/conversations/conversations.service', () => ({
        ConversationsService: undefined,
      }));
      jest.mock('../../src/conversations/dto/create-direct.dto', () => ({
        CreateDirectDto: undefined,
      }));
      jest.mock('../../src/conversations/dto/create-group.dto', () => ({
        CreateGroupDto: undefined,
      }));
      jest.mock('../../src/conversations/dto/invite-member.dto', () => ({
        InviteMemberDto: undefined,
      }));
      jest.mock('../../src/conversations/dto/update-member-status.dto', () => ({
        UpdateMemberStatusDto: undefined,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/conversations/conversations.controller');
    });
  });
});
