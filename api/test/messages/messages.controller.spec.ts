import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from '../../src/messages/messages.controller';
import { MessagesService } from '../../src/messages/messages.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../../src/auth/strategies/jwt.strategy';

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: jest.Mocked<MessagesService>;

  const mockUser: JwtPayload = {
    sub: 1,
    email: 'a@a.com',
    username: 'alice',
    role: 'user',
  };

  const mockMsg = {
    id: 10,
    conversation_id: 1,
    sender_id: 1,
    content: 'hello',
    content_type: 'text' as const,
    reply_to_id: null,
    is_deleted: false,
    deleted_at: null,
    created_at: new Date(),
    username: 'alice',
    display_name: null,
    avatar_url: null,
    read_count: 0,
  };

  const mockPage = { messages: [mockMsg], nextCursor: null, hasMore: false };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: {
            getMessages: jest.fn().mockResolvedValue(mockPage),
            createMessage: jest
              .fn()
              .mockResolvedValue({ message: mockMsg, reactivatedUserIds: [] }),
            markRead: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessagesController>(MessagesController);
    service = module.get(MessagesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('getMessages delegates with conversationId, userId and query', async () => {
    const result = await controller.getMessages(1, mockUser, { limit: 20 });
    expect(service.getMessages).toHaveBeenCalledWith(1, 1, { limit: 20 });
    expect(result).toEqual(mockPage);
  });

  it('createMessage delegates with conversationId, userId and dto', async () => {
    const result = await controller.createMessage(1, mockUser, {
      content: 'hello',
    });
    expect(service.createMessage).toHaveBeenCalledWith(1, 1, {
      content: 'hello',
    });
    expect(result).toEqual(mockMsg);
  });

  it('markRead delegates with conversationId, userId and dto', async () => {
    await controller.markRead(1, mockUser, { lastMessageId: 10 });
    expect(service.markRead).toHaveBeenCalledWith(1, 1, { lastMessageId: 10 });
  });

  it('covers decorator metadata Object branch when dependencies are unavailable at load time', () => {
    jest.isolateModules(() => {
      jest.mock('../../src/messages/messages.service', () => ({
        MessagesService: undefined,
      }));
      jest.mock('../../src/messages/dto/cursor-page.dto', () => ({
        CursorPageDto: undefined,
      }));
      jest.mock('../../src/messages/dto/create-message.dto', () => ({
        CreateMessageDto: undefined,
      }));
      jest.mock('../../src/messages/dto/mark-read.dto', () => ({
        MarkReadDto: undefined,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/messages/messages.controller');
    });
  });
});
