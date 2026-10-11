import { Injectable, NotFoundException } from '@nestjs/common';
import { QuestionRepository } from './question.repository';
import { QuestionDto } from './dto/Question.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import {
  mapGroupedQuestionsToResponse,
  mapQuestionToResponse,
} from './question.mapper';
import { RedisService } from 'src/core/redis/redis.service';

@Injectable()
export class QuestionService {
  constructor(
    private readonly questionRepository: QuestionRepository,
    private readonly redisService: RedisService,
  ) {}
  async createQuestion(questionDto: QuestionDto) {
    const result = mapQuestionToResponse(
      await this.questionRepository.create(questionDto),
    );
    await this.redisService.del('questions:all');
    return result;
  }

  async updateQuestion(id: number, questionDto: QuestionDto) {
    try {
      await this.questionRepository.findByid(id);
      const result = mapQuestionToResponse(
        await this.questionRepository.update(id, questionDto),
      );
      await this.redisService.del('questions:all'); // 👈 invalidate
      return result;
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException(`Question with id ${id} not found`);
      throw error;
    }
  }
  async deleteQuestion(id: number) {
    try {
      await this.questionRepository.remove(id);
      await this.redisService.del('questions:all');
      return { message: `Session ${id} deleted successfully` };
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException(`Question with id ${id} not found`);
      throw error;
    }
  }
  async findById(id: number) {
    const question = await this.questionRepository.findByid(id);
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return mapQuestionToResponse(question);
  }
  async getAllQuestion() {
    // A delayed old cache fill must not disagree with a new Attempt's count.
    return mapGroupedQuestionsToResponse(await this.questionRepository.getALL());
  }

  async createMany(questions: CreateQuestionDto[]) {
    const result = await this.questionRepository.createManyQuestion(questions);
    await this.redisService.del('questions:all');
    return result;
  }
}
