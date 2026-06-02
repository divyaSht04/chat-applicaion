import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway.js';
import { MessagesModule } from '../messages/messages.module.js';

@Module({
  imports: [
    MessagesModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'fallback-secret',
    }),
  ],
  providers: [ChatGateway],
})
export class ChatModule {}
