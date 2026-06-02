import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from '../../src/chat/chat.gateway';
import { MessagesService } from '../../src/messages/messages.service';
import type { JwtPayload } from '../../src/auth/strategies/jwt.strategy';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let jwtService: jest.Mocked<JwtService>;
  let messagesService: jest.Mocked<MessagesService>;

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
    display_name: null,
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: JwtService,
          useValue: { verify: jest.fn() },
        },
        {
          provide: MessagesService,
          useValue: {
            getMessages: jest.fn(),
            createMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    jwtService = module.get(JwtService);
    messagesService = module.get(MessagesService);
  });

  describe('handleConnection', () => {
    it('attaches user to client.data on valid token', () => {
      jwtService.verify.mockReturnValue(fakeUser);
      const client = makeSocket('valid-token');

      gateway.handleConnection(client as never);

      expect(client.data['user']).toEqual(fakeUser);
      expect(client.disconnect).not.toHaveBeenCalled();
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
    it('joins room and emits messageHistory', async () => {
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
      expect(client.emit).toHaveBeenCalledWith('messageHistory', [fakeMessage]);
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

  describe('handleLeaveRoom', () => {
    it('calls client.leave with correct room', () => {
      const client = makeSocket();

      gateway.handleLeaveRoom({ roomId: 10 }, client as never);

      expect(client.leave).toHaveBeenCalledWith('room:10');
    });
  });

  describe('handleSendMessage', () => {
    it('persists message and broadcasts newMessage to room', async () => {
      messagesService.createMessage.mockResolvedValue(fakeMessage);
      const mockTo = { emit: jest.fn() };
      gateway.server = { to: jest.fn().mockReturnValue(mockTo) } as never;
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
