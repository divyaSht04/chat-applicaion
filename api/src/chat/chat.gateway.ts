import { Inject } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import type { Knex } from 'knex';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { MessagesService } from '../messages/messages.service.js';
import { KNEX_TOKEN } from '../database/database.providers.js';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagesService: MessagesService,
    @Inject(KNEX_TOKEN) private readonly knex: Knex,
  ) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth['token'] as string | undefined;
    try {
      const payload = this.jwtService.verify<JwtPayload>(token ?? '');
      (client.data as { user: JwtPayload }).user = payload;
      // Personal room so we can push notifications (e.g. new conversations) to this user
      void client.join(`user:${payload.sub}`);
      // Silently join all conversation rooms so the user receives
      // messages in real-time without having to click each conversation first
      void this.autoJoinRooms(client, payload.sub);
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  /**
   * Called by ConversationsController after createDirect / inviteMember.
   * Adds all of userId's currently-connected sockets to the new room and
   * notifies the client to refresh its conversation list.
   */
  notifyNewConversation(userId: number, conversationId: number): void {
    if (!this.server) return;
    void this.server.in(`user:${userId}`).socketsJoin(`room:${conversationId}`);
    this.server
      .to(`user:${userId}`)
      .emit('conversationCreated', { conversationId });
  }

  notifyConversationDeleted(conversationId: number): void {
    if (!this.server) return;
    this.server
      .to(`room:${conversationId}`)
      .emit('conversationDeleted', { conversationId });
  }

  broadcastMessage(conversationId: number, message: unknown): void {
    if (!this.server) return;
    this.server.to(`room:${conversationId}`).emit('newMessage', message);
  }

  notifyMemberRemoved(userId: number, conversationId: number): void {
    if (!this.server) return;
    void this.server
      .in(`user:${userId}`)
      .socketsLeave(`room:${conversationId}`);
    this.server
      .to(`user:${userId}`)
      .emit('removedFromConversation', { conversationId });
  }

  handleDisconnect(): void {}

  private async autoJoinRooms(client: Socket, userId: number): Promise<void> {
    const rows = await this.knex<{ conversation_id: number }>(
      'conversation_members',
    )
      .where({ user_id: userId })
      .whereIn('status', ['accepted', 'pending'])
      .select('conversation_id');

    if (rows.length > 0) {
      await client.join(rows.map((r) => `room:${r.conversation_id}`));
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = (client.data as { user: JwtPayload }).user;
    await client.join(`room:${data.roomId}`);
    try {
      const { messages, hasMore } = await this.messagesService.getMessages(
        data.roomId,
        user.sub,
        { limit: 50 },
      );
      client.emit('messageHistory', { messages, hasMore });
    } catch {
      client.emit('error', { message: 'Cannot join room' });
    }
  }

  @SubscribeMessage('loadMoreMessages')
  async handleLoadMoreMessages(
    @MessageBody() data: { roomId: number; before: number },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = (client.data as { user: JwtPayload }).user;
    try {
      const { messages, hasMore } = await this.messagesService.getMessages(
        data.roomId,
        user.sub,
        { limit: 50, before: data.before },
      );
      client.emit('olderMessages', { messages, hasMore });
    } catch {
      client.emit('error', { message: 'Failed to load messages' });
    }
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ): void {
    void client.leave(`room:${data.roomId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { roomId: number; content: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = (client.data as { user: JwtPayload }).user;
    try {
      const { message, reactivatedUserIds } =
        await this.messagesService.createMessage(data.roomId, user.sub, {
          content: data.content,
        });
      this.server.to(`room:${data.roomId}`).emit('newMessage', message);
      // Re-add any users who had previously deleted this conversation so the
      // conversation reappears on their end with the new message
      for (const userId of reactivatedUserIds) {
        this.notifyNewConversation(userId, data.roomId);
      }
    } catch {
      client.emit('error', { message: 'Failed to send message' });
    }
  }
}
