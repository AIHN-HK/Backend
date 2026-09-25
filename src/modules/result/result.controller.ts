import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';

import { ResultService } from './result.service';
import { ResponseMessage } from 'src/core/decorators/response-message.decorator';
import { TopCodeDto } from './dto/create_result.dto';
import { ApiQuery } from '@nestjs/swagger/dist/decorators/api-query.decorator';
import { ApiBearerAuth } from '@nestjs/swagger/dist/decorators/api-bearer.decorator';
import { CurrentUser } from 'src/core/decorators/current-user.decorator';
// import { createResultInput } from './dto/create_result.dto';

@Controller('result')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}
  // @HttpCode(HttpStatus.CREATED)
  // @Post('create')
  // async createResult(@Body() body: createResultInput) {
  //   return {
  //     message: 'Result created successfully',
  //     status: HttpStatus.CREATED,
  //     data: await this.resultService.createResult(body.attemptId),
  //   };
  // }
  //@Param('attemptId'
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Results retrieved successfully')
  @Get(':attemptId')
  async getResults(
    @Param('attemptId') attemptId: string,
    @CurrentUser('id') userId: number,
  ) {
    return this.resultService.getResultRanking(
      Number.parseInt(attemptId),
      userId,
    );
  }
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('history results retrieved successfully')
  @Get('attempt/snapshots/:attemptId')
  async getAllResultsByAttemptId(
    @Param('attemptId') attemptId: string,
    @CurrentUser('id') userId: number,
  ) {
    return this.resultService.Getsnapshot(Number.parseInt(attemptId), userId);
  }
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Analyze top result fetched successfully')
  @Get('analyze-result/:attemptId')
  async analyzeResult(
    @Param('attemptId') attemptId: string,
    @CurrentUser('id') userId: number,
  ) {
    return await this.resultService.getAnalyzeResultsByAttemptId(
      Number.parseInt(attemptId),
      userId,
    );
  }
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Top code results fetched successfully')
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Holland top code (R, I, A, S, E, C)',
    example: 'I',
  })
  @Get('analyze/topcode')
  async getTopCode(@Query() query: TopCodeDto) {
    return this.resultService.getAnalyzeResultsByTopCode(
      query.code.toUpperCase(),
    );
  }
}
