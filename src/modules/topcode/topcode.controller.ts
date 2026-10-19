import { Roles } from 'src/core/decorators/roles.decorator';
import { UserRole } from 'src/core/types/user.type';
import { Body, Controller, Put } from '@nestjs/common';
import { TopcodeService } from './topcode.service';
import { UpdateTopcodeBodyDto } from './dto/update.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('topcode')
export class TopcodeController {
  constructor(private readonly topcodeService: TopcodeService) {}
  @Roles(UserRole.ADMIN)
  @Put()
  async updateTopcode(
    @Body() body: UpdateTopcodeBodyDto,
    @CurrentUser('id') actorId: number,
  ) {
    return this.topcodeService.updateTopcode(body, actorId);
  }
}
