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
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { MessagesService } from '../messages/messages.service.js';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagesService: MessagesService,
  ) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth['token'] as string | undefined;
    try {
      const payload = this.jwtService.verify<JwtPayload>(token ?? '');
      (client.data as { user: JwtPayload }).user = payload;
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  handleDisconnect(): void {}

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = (client.data as { user: JwtPayload }).user;
    await client.join(`room:${data.roomId}`);
    try {
      const { messages } = await this.messagesService.getMessages(
        data.roomId,
        user.sub,
        { limit: 50 },
      );
      client.emit('messageHistory', messages);
    } catch {
      client.emit('error', { message: 'Cannot join room' });
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
      const message = await this.messagesService.createMessage(
        data.roomId,
        user.sub,
        { content: data.content },
      );
      this.server.to(`room:${data.roomId}`).emit('newMessage', message);
    } catch {
      client.emit('error', { message: 'Failed to send message' });
    }
  }
}
