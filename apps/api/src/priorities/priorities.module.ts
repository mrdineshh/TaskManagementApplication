import { Module } from '@nestjs/common';
import { PrioritiesController } from './priorities.controller';

@Module({
  controllers: [PrioritiesController],
})
export class PrioritiesModule {}
