import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../core/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { GuestAssessmentService } from './guest-assessment.service';
import { GuestClaimDto, GuestPreviewDto } from './guest-assessment.dto';

@Controller('guest-assessment')
export class GuestAssessmentController {
  constructor(private readonly service: GuestAssessmentService) {}
  @Public()
  @Get('catalog')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  catalog() {
    return this.service.catalog();
  }

  @Public()
  @Post('preview')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  preview(@Body() input: GuestPreviewDto) {
    return this.service.preview(input);
  }

  @Post('claim')
  @HttpCode(200)
  claim(@Body() input: GuestClaimDto, @CurrentUser('id') userId: number) {
    return this.service.claim(input.receipt, userId);
  }

  @Get('claim/:id')
  @Header('Cache-Control', 'no-store')
  lookup(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: number,
  ) {
    return this.service.lookup(id, userId);
  }
}
