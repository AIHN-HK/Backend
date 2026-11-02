import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { UserRole } from '../../core/types/user.type';
import { CareerService } from './career.service';
import { CareerProgressService } from './career-progress.service';
import {
  CareerProfileInput,
  CareerQuery,
  CreateRecommendationInput,
  PublishCareerInput,
  CreateGoalInput,
  UpdateGoalTaskInput,
  GoalRevisionInput,
} from './career.dto';

@Controller('careers')
export class CareerController {
  constructor(private readonly service: CareerService) {}
  @Public() @Get() list(@Query() query: CareerQuery) {
    return this.service.list(query);
  }
  @Public() @Get('skills') skills() {
    return this.service.skills();
  }
  @Public() @Get(':id') detail(@Param('id') id: string) {
    return this.service.detail(id);
  }
}
@Controller('career')
export class PersonalCareerController {
  constructor(private readonly service: CareerService) {}
  @Get('profile') profile(@CurrentUser('id') owner: number) {
    return this.service.profile(owner);
  }
  @Put('profile') save(
    @CurrentUser('id') owner: number,
    @Body() body: CareerProfileInput,
  ) {
    return this.service.saveProfile(owner, body);
  }
  @Post('recommendations') recommend(
    @CurrentUser('id') owner: number,
    @Body() body: CreateRecommendationInput,
  ) {
    return this.service.recommend(owner, body.attemptId);
  }
  @Get('recommendations/latest') latest(@CurrentUser('id') owner: number) {
    return this.service.latest(owner);
  }
  @Get('recommendations/:id') run(
    @CurrentUser('id') owner: number,
    @Param('id') id: string,
  ) {
    return this.service.run(owner, id);
  }
}
@Controller('admin/career-data')
@Roles(UserRole.ADMIN)
export class AdminCareerController {
  constructor(private readonly service: CareerService) {}
  @Get() list(@Query() query: CareerQuery) {
    return this.service.list(query, true);
  }
  @Get('skills') skills() {
    return this.service.skills();
  }
  @Patch(':id') publish(
    @CurrentUser('id') owner: number,
    @Param('id') id: string,
    @Body() body: PublishCareerInput,
  ) {
    return this.service.publish(id, body.revision, body.active, owner);
  }
}

@Controller('career')
export class CareerProgressController {
  constructor(private readonly progress: CareerProgressService) {}
  @Get('gaps/:careerId') gap(
    @CurrentUser('id') owner: number,
    @Param('careerId') id: string,
  ) {
    return this.progress.gap(owner, id);
  }
  @Get('goals') goals(@CurrentUser('id') owner: number) {
    return this.progress.goals(owner);
  }
  @Post('goals') create(
    @CurrentUser('id') owner: number,
    @Body() body: CreateGoalInput,
  ) {
    return this.progress.create(owner, body.careerId);
  }
  @Patch('goals/:id/tasks/:taskId') update(
    @CurrentUser('id') owner: number,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() body: UpdateGoalTaskInput,
  ) {
    return this.progress.update(
      owner,
      id,
      taskId,
      body.revision,
      body.done,
      body.evidence,
    );
  }
  @Post('goals/:id/regenerate') regenerate(
    @CurrentUser('id') owner: number,
    @Param('id') id: string,
    @Body() body: GoalRevisionInput,
  ) {
    return this.progress.regenerate(owner, id, body.revision);
  }
  @Get('analytics') analytics(@CurrentUser('id') owner: number) {
    return this.progress.analytics(owner);
  }
}
@Controller('admin/career-analytics')
@Roles(UserRole.ADMIN)
export class AdminCareerAnalyticsController {
  constructor(private readonly progress: CareerProgressService) {}
  @Get() analytics() {
    return this.progress.adminAnalytics();
  }
}
