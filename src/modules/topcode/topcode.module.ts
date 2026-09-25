import { Module } from '@nestjs/common';
import { TopcodeController } from './topcode.controller';
import { TopcodeService } from './topcode.service';
import { TopcodeRepository } from './topcode.repository';

@Module({
  controllers: [TopcodeController],
  providers: [TopcodeService, TopcodeRepository],
  exports: [TopcodeService, TopcodeRepository],
})
export class TopcodeModule {}
