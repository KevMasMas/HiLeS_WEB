import 'dotenv/config';
import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConnectionsModule } from './modules/connections/connections.module.js';
import { ElementsModule } from './modules/elements/elements.module.js';
import { ModelsModule } from './modules/models/models.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { SimulationModule } from './modules/simulation/simulation.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const observeAppKey = process.env.OBSERVE_APP_KEY;
const observeAppSecret = process.env.OBSERVE_APP_SECRET;
const observeImports = observeAppKey && observeAppSecret
  ? [ObserveModule.forRoot({ appKey: observeAppKey, appSecret: observeAppSecret, serviceId: 'backend' })]
  : [];

@Module({
  imports: [
    ProjectsModule,
    ModelsModule,
    ElementsModule,
    ConnectionsModule,
    SimulationModule,
    ...observeImports,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
