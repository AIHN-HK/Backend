import { Roles } from 'src/core/decorators/roles.decorator';
import { UserRole } from 'src/core/types/user.type';
import {
  Controller,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  NotFoundException,
  Get,
  Query,
} from '@nestjs/common';
import { TestSessionService } from './test-session.service';
import { ResponseMessage } from 'src/core/decorators/response-message.decorator';
import { CurrentUser } from 'src/core/decorators/current-user.decorator';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

// import { Session } from 'inspector/promises';
@Controller('test-session')
export class TestSessionController {
  constructor(private readonly sessionService: TestSessionService) {}
  @ResponseMessage('User history retrieved successfully')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Session created successfully')
  @Post()
  async create(@CurrentUser('id') id: number) {
    return await this.sessionService.createSession(id);
  }
  @ResponseMessage('Session deleted successfully')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.sessionService.deleteSession(id);
    } catch (error) {
      throw new NotFoundException(`Session with id ${id} not found`);
    }
  }
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'cursorCreatedAt',
    required: false,
    type: String,
    example: '2026-02-05T12:30:00.000Z',
  })
  @ApiQuery({
    name: 'cursorId',
    required: false,
    type: Number,
    example: 123,
  })
  @ResponseMessage('User history retrieved successfully')
  @ApiBearerAuth('JWT-auth')
  @Get('history-by-user')
  async getHistory(
    @CurrentUser('id') userId: number,
    @Query('limit') limit?: string,
    @Query('cursorCreatedAt') cursorCreatedAt?: string,
    @Query('cursorId') cursorId?: string,
  ) {
    return this.sessionService.getHistoryUser(
      userId,
      Number(limit) || 10,
      cursorCreatedAt,
      cursorId ? Number(cursorId) : undefined,
    );
  }
}
