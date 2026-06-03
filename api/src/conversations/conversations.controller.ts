import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service.js';
import { ChatGateway } from '../chat/chat.gateway.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { CreateDirectDto } from './dto/create-direct.dto.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { InviteMemberDto } from './dto/invite-member.dto.js';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto.js';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('direct')
  async createDirect(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDirectDto,
  ) {
    const conv = await this.conversationsService.createDirect(user.sub, dto);
    this.chatGateway.notifyNewConversation(dto.recipientId, conv.id);
    return conv;
  }

  @Post('group')
  createGroup(@CurrentUser() user: JwtPayload, @Body() dto: CreateGroupDto) {
    return this.conversationsService.createGroup(user.sub, dto);
  }

  @Get()
  findMyConversations(@CurrentUser() user: JwtPayload) {
    return this.conversationsService.findMyConversations(user.sub);
  }

  // Declared before /:id to prevent "requests" being parsed as an id param
  @Get('requests')
  findMyRequests(@CurrentUser() user: JwtPayload) {
    return this.conversationsService.findMyRequests(user.sub);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversationsService.findOne(id, user.sub);
  }

  @Get(':id/members')
  getMembers(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversationsService.getMembers(id, user.sub);
  }

  @Post(':id/members')
  async inviteMember(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: InviteMemberDto,
  ) {
    const member = await this.conversationsService.inviteMember(
      id,
      user.sub,
      dto,
    );
    this.chatGateway.notifyNewConversation(dto.userId, id);
    const msg = await this.conversationsService.notifyMemberJoined(
      id,
      dto.userId,
    );
    if (msg) this.chatGateway.broadcastMessage(id, msg);
    return member;
  }

  @Patch(':id/members/me')
  @HttpCode(HttpStatus.OK)
  updateMyStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateMemberStatusDto,
  ) {
    return this.conversationsService.updateMyStatus(id, user.sub, dto);
  }

  // Must be declared before :id/members/:userId so "me" isn't parsed as a userId
  @Delete(':id/members/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveConversation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    const msg = await this.conversationsService.leaveConversation(id, user.sub);
    if (msg) this.chatGateway.broadcastMessage(id, msg);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    const msg = await this.conversationsService.removeMember(
      id,
      user.sub,
      userId,
    );
    if (msg) this.chatGateway.broadcastMessage(id, msg);
    this.chatGateway.notifyMemberRemoved(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGroup(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.conversationsService.deleteGroup(id, user.sub);
    this.chatGateway.notifyConversationDeleted(id);
  }
}
