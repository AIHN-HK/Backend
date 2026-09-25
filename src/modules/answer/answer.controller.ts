import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SubmitAnswerDto, SubmitAnswerDtoV2 } from './dto/create_answer.dto';
import { AnswerService } from './answer.service';
import { ResponseMessage } from 'src/core/decorators/response-message.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from 'src/core/decorators/current-user.decorator';

@Controller('answer')
export class AnswerController {
  constructor(private readonly answerService: AnswerService) {}
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Answers submitted successfully')
  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  async createAnswer(
    @Body() body: SubmitAnswerDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.answerService.createAnswer(body, userId);
  }
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Answers submitted successfully')
  @Post('submit-v2')
  @HttpCode(HttpStatus.CREATED)
  async createAnswerV2(
    @Body() body: SubmitAnswerDtoV2,
    @CurrentUser('id') userId: number,
  ) {
    return this.answerService.createAnswerV2(body, userId);
  }
}
