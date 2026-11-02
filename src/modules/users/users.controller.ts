import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @SkipThrottle()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@CurrentUser('id') userId: number) {
    return this.usersService.findById(userId);
  }
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async updateProfile(
    @CurrentUser('id') userId: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(userId, updateUserDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    if (id !== userId)
      throw new ForbiddenException('Only your own profile is accessible');
    return this.usersService.findById(userId);
  }
}
