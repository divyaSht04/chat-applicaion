import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from '../../src/metrics/metrics.controller';
import { MetricsService } from '../../src/metrics/metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: MetricsService;

  beforeEach(async () => {
    metricsService = new MetricsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: metricsService }],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  it('sets Content-Type and writes prometheus output', async () => {
    const res = { set: jest.fn(), end: jest.fn() };

    await controller.getMetrics(res as never);

    expect(res.set).toHaveBeenCalledWith(
      'Content-Type',
      metricsService.registry.contentType,
    );
    expect(res.end).toHaveBeenCalledWith(
      expect.stringContaining('http_requests_total'),
    );
  });
});
