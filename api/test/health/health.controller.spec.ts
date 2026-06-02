import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { HealthController } from '../../src/health/health.controller';
import { DbHealthIndicator } from '../../src/health/db-health.indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<HealthCheckService>;

  const fakeResult = {
    status: 'ok',
    info: { database: { status: 'up' }, memory_heap: { status: 'up' } },
    error: {},
    details: { database: { status: 'up' }, memory_heap: { status: 'up' } },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: { check: jest.fn() },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: { checkHeap: jest.fn() },
        },
        {
          provide: DbHealthIndicator,
          useValue: { isHealthy: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get(HealthCheckService);
  });

  it('calls health.check with db and memory indicators', async () => {
    healthService.check.mockResolvedValue(fakeResult as never);

    const result = await controller.check();

    expect(healthService.check).toHaveBeenCalledWith([
      expect.any(Function),
      expect.any(Function),
    ]);
    expect(result).toEqual(fakeResult);
  });
});
