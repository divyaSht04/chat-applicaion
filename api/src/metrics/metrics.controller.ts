import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service.js';

@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metricsService.registry.contentType);
    res.end(await this.metricsService.registry.metrics());
  }
}
