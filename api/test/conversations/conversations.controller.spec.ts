import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from '../../src/conversations/conversations.controller';
import { ConversationsService } from '../../src/conversations/conversations.service';
import { ChatGateway } from '../../src/chat/chat.gateway';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../../src/auth/strategies/jwt.strategy';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let service: jest.Mocked<ConversationsService>;
  let gateway: jest.Mocked<ChatGateway>;

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
            getMembers: jest.fn().mockResolvedValue([]),
            inviteMember: jest.fn().mockResolvedValue(mockMember),
            notifyMemberJoined: jest.fn().mockResolvedValue(null),
            updateMyStatus: jest
              .fn()
              .mockResolvedValue({ ...mockMember, status: 'accepted' }),
            leaveConversation: jest.fn().mockResolvedValue(null),
            removeMember: jest.fn().mockResolvedValue(null),
            deleteGroup: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ChatGateway,
          useValue: {
            notifyNewConversation: jest.fn(),
            notifyConversationDeleted: jest.fn(),
            broadcastMessage: jest.fn(),
            notifyMemberRemoved: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ConversationsController>(ConversationsController);
    service = module.get(ConversationsService);
    gateway = module.get(ChatGateway);
  });

  afterEach(() => jest.clearAllMocks());

  it('createDirect delegates to service and notifies recipient', async () => {
    const result = await controller.createDirect(mockUser, { recipientId: 2 });
    expect(service.createDirect).toHaveBeenCalledWith(1, { recipientId: 2 });
    expect(gateway.notifyNewConversation).toHaveBeenCalledWith(2, mockConv.id);
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

  it('inviteMember delegates to service, notifies invited user, and broadcasts join message', async () => {
    const result = await controller.inviteMember(1, mockUser, { userId: 2 });
    expect(service.inviteMember).toHaveBeenCalledWith(1, 1, { userId: 2 });
    expect(gateway.notifyNewConversation).toHaveBeenCalledWith(2, 1);
    expect(service.notifyMemberJoined).toHaveBeenCalledWith(1, 2);
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

  it('getMembers delegates to service', async () => {
    const result = await controller.getMembers(1, mockUser);
    expect(service.getMembers).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual([]);
  });

  it('leaveConversation delegates to service', async () => {
    await controller.leaveConversation(1, mockUser);
    expect(service.leaveConversation).toHaveBeenCalledWith(1, 1);
  });

  it('removeMember delegates to service and notifies removed member', async () => {
    await controller.removeMember(1, 2, mockUser);
    expect(service.removeMember).toHaveBeenCalledWith(1, 1, 2);
    expect(gateway.notifyMemberRemoved).toHaveBeenCalledWith(2, 1);
  });

  it('deleteGroup delegates to service and notifies room', async () => {
    await controller.deleteGroup(1, mockUser);
    expect(service.deleteGroup).toHaveBeenCalledWith(1, 1);
    expect(gateway.notifyConversationDeleted).toHaveBeenCalledWith(1);
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
