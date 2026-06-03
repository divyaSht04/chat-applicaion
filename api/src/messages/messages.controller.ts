import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { CursorPageDto } from './dto/cursor-page.dto.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { MarkReadDto } from './dto/mark-read.dto.js';

@Controller('conversations/:conversationId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  getMessages(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @CurrentUser() user: JwtPayload,
    @Query() query: CursorPageDto,
  ) {
    return this.messagesService.getMessages(conversationId, user.sub, query);
  }

  @Post()
  async createMessage(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMessageDto,
  ) {
    const { message } = await this.messagesService.createMessage(
      conversationId,
      user.sub,
      dto,
    );
    return message;
  }

  @Post('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: MarkReadDto,
  ) {
    return this.messagesService.markRead(conversationId, user.sub, dto);
  }
}
