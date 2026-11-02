import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { UserRole } from '../../core/types/user.type';
import { AdminService } from './admin.service';
import { AdminPageDto, AdminPrioritiesDto } from './admin.dto';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('me') me(
    @CurrentUser() user: { id: number; fullname: string; role: string },
  ) {
    return { id: user.id, fullname: user.fullname, role: user.role };
  }
  @Get('overview') overview() {
    return this.admin.overview();
  }
  @Get('students') students(@Query() query: AdminPageDto) {
    return this.admin.students(query);
  }
  @Get('students/:id') student(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AdminPageDto,
  ) {
    return this.admin.student(id, query);
  }
  @Get('questions') questions() {
    return this.admin.questions();
  }
  @Get('topcodes') topcodes() {
    return this.admin.topcodes();
  }
  @Put('priorities') priorities(
    @Body() body: AdminPrioritiesDto,
    @CurrentUser('id') actorId: number,
  ) {
    return this.admin.priorities(body, actorId);
  }
}
