import { Body, Controller, Put } from '@nestjs/common';
import { TopcodeService } from './topcode.service';
import { UpdateTopcodeBodyDto } from './dto/update.dto';
import { Public } from 'src/core/decorators/public.decorator';

@Controller('topcode')
export class TopcodeController {
  constructor(private readonly topcodeService: TopcodeService) {}
  @Public()
  @Put()
  async updateTopcode(@Body() body: UpdateTopcodeBodyDto) {
    return this.topcodeService.updateTopcode(body);
  }
}
