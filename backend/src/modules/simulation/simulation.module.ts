import { Module } from '@nestjs/common';
import { SimulationController } from './simulation.controller.js';
import { SimulationService } from './simulation.service.js';

@Module({
  controllers: [SimulationController],
  providers: [SimulationService],
  exports: [SimulationService],
})
export class SimulationModule {}
