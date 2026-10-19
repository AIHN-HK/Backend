import { Controller, Get, Param, Req, ParseIntPipe } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ResponseMessage } from 'src/core/decorators/response-message.decorator';

interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    role: string;
  };
}
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}
  @ResponseMessage('get Chat session successfully')
  @Get('sessions')
  async getSessions(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.chatService.getSessionsChatByUser(Number(userId));
  }
  @Get('sessions/:sessionId/messages')
  async getMessages(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.chatService.getMessage(sessionId, req.user.id);
  }
}
