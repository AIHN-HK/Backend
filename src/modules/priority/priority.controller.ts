import { Roles } from 'src/core/decorators/roles.decorator';
import { UserRole } from 'src/core/types/user.type';
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
  @ResponseMessage('Priorities updated successfully')
  @Roles(UserRole.ADMIN)
  @Put()
  async updatePriorities(@Body() body: UpdatePriorityDto) {
    return this.priorityService.updatePriorities(body);
  }
}
