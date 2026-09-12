import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { SimulationService } from './simulation.service.js';

@Controller('api/simulations/demo')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Get()
  getState() {
    return this.simulationService.getState();
  }

  @Post('input')
  publishInput(@Body() body: { value?: unknown }) {
    if (typeof body?.value !== 'boolean') {
      throw new BadRequestException('value must be a boolean');
    }
    return this.simulationService.publishInput(body.value);
  }

  @Post('reset')
  reset() {
    return this.simulationService.reset();
  }
}
