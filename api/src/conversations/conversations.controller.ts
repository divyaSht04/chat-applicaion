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
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post('direct')
  createDirect(@CurrentUser() user: JwtPayload, @Body() dto: CreateDirectDto) {
    return this.conversationsService.createDirect(user.sub, dto);
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

  @Post(':id/members')
  inviteMember(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: InviteMemberDto,
  ) {
    return this.conversationsService.inviteMember(id, user.sub, dto);
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

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversationsService.removeMember(id, user.sub, userId);
  }
}
