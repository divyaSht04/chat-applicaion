import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from '../../src/chat/chat.gateway';
import { MessagesService } from '../../src/messages/messages.service';
import { KNEX_TOKEN } from '../../src/database/database.providers';
import type { JwtPayload } from '../../src/auth/strategies/jwt.strategy';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let jwtService: jest.Mocked<JwtService>;
  let messagesService: jest.Mocked<MessagesService>;
  let mockKnex: jest.Mock;

  const fakeUser: JwtPayload = {
    sub: 1,
    email: 'alice@example.com',
    username: 'alice',
    role: 'user',
  };

  const fakeMessage = {
    id: 1,
    conversation_id: 10,
    sender_id: 1,
    content: 'hello',
    content_type: 'text' as const,
    reply_to_id: null,
    is_deleted: false,
    deleted_at: null,
    created_at: new Date(),
    username: 'alice',
    avatar_url: null,
    read_count: 0,
  };

  function makeSocket(token?: string) {
    return {
      handshake: { auth: { token } },
      data: {} as Record<string, unknown>,
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    };
  }

  // Build a chainable Knex query builder stub (supports autoJoinRooms which uses where+whereIn+select)
  function makeKnexChain(resolveWith: unknown) {
    const qb: Record<string, jest.Mock> = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(resolveWith),
    };
    return qb;
  }

  beforeEach(async () => {
    mockKnex = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: JwtService, useValue: { verify: jest.fn() } },
        {
          provide: MessagesService,
          useValue: { getMessages: jest.fn(), createMessage: jest.fn() },
        },
        { provide: KNEX_TOKEN, useValue: mockKnex },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    jwtService = module.get(JwtService);
    messagesService = module.get(MessagesService);
  });

  describe('handleConnection', () => {
    it('attaches user and auto-joins rooms on valid token', async () => {
      jwtService.verify.mockReturnValue(fakeUser);
      mockKnex.mockReturnValue(
        makeKnexChain([{ conversation_id: 10 }, { conversation_id: 20 }]),
      );
      const client = makeSocket('valid-token');

      gateway.handleConnection(client as never);
      // autoJoinRooms is async — wait for the microtask queue
      await Promise.resolve();
      await Promise.resolve();

      expect(client.data['user']).toEqual(fakeUser);
      expect(client.disconnect).not.toHaveBeenCalled();
      // First join: personal user room; second join: conversation rooms
      expect(client.join).toHaveBeenCalledWith('user:1');
      expect(client.join).toHaveBeenCalledWith(['room:10', 'room:20']);
    });

    it('does not join conversation rooms when user has no conversations', async () => {
      jwtService.verify.mockReturnValue(fakeUser);
      mockKnex.mockReturnValue(makeKnexChain([]));
      const client = makeSocket('valid-token');

      gateway.handleConnection(client as never);
      await Promise.resolve();
      await Promise.resolve();

      // Only the personal user room is joined; no conversation rooms
      expect(client.join).toHaveBeenCalledWith('user:1');
      expect(client.join).toHaveBeenCalledTimes(1);
    });

    it('emits error and disconnects on invalid token', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      const client = makeSocket('bad-token');

      gateway.handleConnection(client as never);

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Unauthorized',
      });
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects when no token provided', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      const client = makeSocket(undefined);

      gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('does not throw', () => {
      expect(() => gateway.handleDisconnect()).not.toThrow();
    });
  });

  describe('handleJoinRoom', () => {
    it('joins room and emits messageHistory with hasMore', async () => {
      messagesService.getMessages.mockResolvedValue({
        messages: [fakeMessage],
        nextCursor: null,
        hasMore: false,
      });
      const client = makeSocket();
      client.data['user'] = fakeUser;

      await gateway.handleJoinRoom({ roomId: 10 }, client as never);

      expect(client.join).toHaveBeenCalledWith('room:10');
      expect(messagesService.getMessages).toHaveBeenCalledWith(10, 1, {
        limit: 50,
      });
      expect(client.emit).toHaveBeenCalledWith('messageHistory', {
        messages: [fakeMessage],
        hasMore: false,
      });
    });

    it('emits error when getMessages throws', async () => {
      messagesService.getMessages.mockRejectedValue(new Error('forbidden'));
      const client = makeSocket();
      client.data['user'] = fakeUser;

      await gateway.handleJoinRoom({ roomId: 10 }, client as never);

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Cannot join room',
      });
    });
  });

  describe('handleLoadMoreMessages', () => {
    it('emits olderMessages with the requested page', async () => {
      messagesService.getMessages.mockResolvedValue({
        messages: [fakeMessage],
        nextCursor: 5,
        hasMore: true,
      });
      const client = makeSocket();
      client.data['user'] = fakeUser;

      await gateway.handleLoadMoreMessages(
        { roomId: 10, before: 20 },
        client as never,
      );

      expect(messagesService.getMessages).toHaveBeenCalledWith(10, 1, {
        limit: 50,
        before: 20,
      });
      expect(client.emit).toHaveBeenCalledWith('olderMessages', {
        messages: [fakeMessage],
        hasMore: true,
      });
    });

    it('emits error when getMessages throws', async () => {
      messagesService.getMessages.mockRejectedValue(new Error('forbidden'));
      const client = makeSocket();
      client.data['user'] = fakeUser;

      await gateway.handleLoadMoreMessages(
        { roomId: 10, before: 20 },
        client as never,
      );

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Failed to load messages',
      });
    });
  });

  describe('handleLeaveRoom', () => {
    it('calls client.leave with correct room', () => {
      const client = makeSocket();

      gateway.handleLeaveRoom({ roomId: 10 }, client as never);

      expect(client.leave).toHaveBeenCalledWith('room:10');
    });
  });

  describe('handleSendMessage', () => {
    it('persists message and broadcasts newMessage to room', async () => {
      messagesService.createMessage.mockResolvedValue({
        message: fakeMessage,
        reactivatedUserIds: [],
      });
      const mockTo = { emit: jest.fn() };
      gateway.server = {
        to: jest.fn().mockReturnValue(mockTo),
        in: jest.fn().mockReturnValue({ socketsJoin: jest.fn() }),
      } as never;
      const client = makeSocket();
      client.data['user'] = fakeUser;

      await gateway.handleSendMessage(
        { roomId: 10, content: 'hello' },
        client as never,
      );

      expect(messagesService.createMessage).toHaveBeenCalledWith(10, 1, {
        content: 'hello',
      });
      expect(gateway.server.to).toHaveBeenCalledWith('room:10');
      expect(mockTo.emit).toHaveBeenCalledWith('newMessage', fakeMessage);
    });

    it('notifies reactivated users when they had previously deleted the conversation', async () => {
      messagesService.createMessage.mockResolvedValue({
        message: fakeMessage,
        reactivatedUserIds: [99],
      });
      const mockTo = { emit: jest.fn() };
      const mockIn = { socketsJoin: jest.fn() };
      gateway.server = {
        to: jest.fn().mockReturnValue(mockTo),
        in: jest.fn().mockReturnValue(mockIn),
      } as never;
      const client = makeSocket();
      client.data['user'] = fakeUser;

      await gateway.handleSendMessage(
        { roomId: 10, content: 'hey' },
        client as never,
      );

      // notifyNewConversation emits to 'user:99'
      expect(gateway.server.to).toHaveBeenCalledWith(
        expect.stringContaining('user:99'),
      );
    });

    it('emits error when createMessage throws', async () => {
      messagesService.createMessage.mockRejectedValue(new Error('forbidden'));
      const client = makeSocket();
      client.data['user'] = fakeUser;

      await gateway.handleSendMessage(
        { roomId: 10, content: 'hi' },
        client as never,
      );

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Failed to send message',
      });
    });
  });
});
