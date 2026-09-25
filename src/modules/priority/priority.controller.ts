import { Body, Controller, Get, Put } from '@nestjs/common';
import { PriorityService } from './priority.service';
import { ResponseMessage } from 'src/core/decorators/response-message.decorator';
import { UpdatePriorityDto } from './dto/updateDto';
import { Public } from 'src/core/decorators/public.decorator';

@Controller('priority')
export class PriorityController {
  constructor(private readonly priorityService: PriorityService) {}
  @Public()
  @ResponseMessage('Priorities retrieved successfully')
  @Get()
  async getPriorities() {
    return this.priorityService.getPriorities();
  }
  @Public()
  @ResponseMessage('Priorities updated successfully')
  @Put()
  async updatePriorities(@Body() body: UpdatePriorityDto) {
    return this.priorityService.updatePriorities(body);
  }
}
