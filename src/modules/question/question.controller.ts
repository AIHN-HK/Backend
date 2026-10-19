import { Roles } from 'src/core/decorators/roles.decorator';
import { UserRole } from 'src/core/types/user.type';
import {
  Body,
  Controller,
  Patch,
  Post,
  Param,
  ParseIntPipe,
  Get,
  Delete,
} from '@nestjs/common';
import { QuestionDto } from './dto/Question.dto';
import { QuestionService } from './question.service';
import { BulkCreateQuestionDto } from './dto/bulk-create-question.dto';
import { ResponseMessage } from 'src/core/decorators/response-message.decorator';
import { Public } from 'src/core/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('question')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}
  @ResponseMessage('Question created successfully')
  @Roles(UserRole.ADMIN)
  @Post()
  async create(
    @Body() createQuestionDto: QuestionDto,
    @CurrentUser('id') actorId: number,
  ) {
    return {
      data: await this.questionService.createQuestion(
        createQuestionDto,
        actorId,
      ),
    };
  }
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQuestionDto: QuestionDto,
    @CurrentUser('id') actorId: number,
  ) {
    return this.questionService.updateQuestion(id, updateQuestionDto, actorId);
  }
  @Public()
  @ResponseMessage('Question retrieved successfully')
  @Get(':id')
  async getQuestion(@Param('id', ParseIntPipe) id: number) {
    return {
      data: await this.questionService.findById(id),
    };
  }
  @ResponseMessage('Question deleted successfully')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async deleteQuestion(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') actorId: number,
  ) {
    return {
      data: await this.questionService.deleteQuestion(id, actorId),
    };
  }
  @Public()
  @ResponseMessage('Questions retrieved successfully')
  @Get('')
  async getAllQuestion() {
    return {
      questions: await this.questionService.getAllQuestion(),
    };
  }
  @ResponseMessage('Questions created successfully')
  @Roles(UserRole.ADMIN)
  @Post('bulk')
  async createManyQuestion(
    @Body() dto: BulkCreateQuestionDto,
    @CurrentUser('id') actorId: number,
  ) {
    return {
      data: await this.questionService.createMany(dto.questions, actorId),
    };
  }
}
