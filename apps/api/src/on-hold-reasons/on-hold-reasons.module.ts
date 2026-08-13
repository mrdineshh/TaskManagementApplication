import { Module } from '@nestjs/common';
import { OnHoldReasonsController } from './on-hold-reasons.controller';

@Module({
  controllers: [OnHoldReasonsController],
})
export class OnHoldReasonsModule {}
