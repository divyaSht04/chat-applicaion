import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { DbHealthIndicator } from '../../src/health/db-health.indicator';
import { KNEX_TOKEN } from '../../src/database/database.providers';

describe('DbHealthIndicator', () => {
  let indicator: DbHealthIndicator;
  let mockKnex: { raw: jest.Mock };

  beforeEach(async () => {
    mockKnex = { raw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbHealthIndicator,
        { provide: KNEX_TOKEN, useValue: mockKnex },
      ],
    }).compile();

    indicator = module.get<DbHealthIndicator>(DbHealthIndicator);
  });

  it('returns healthy status when SELECT 1 succeeds', async () => {
    mockKnex.raw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await indicator.isHealthy('database');

    expect(result).toEqual({ database: { status: 'up' } });
  });

  it('throws HealthCheckError when SELECT 1 fails', async () => {
    mockKnex.raw.mockRejectedValue(new Error('connection refused'));

    await expect(indicator.isHealthy('database')).rejects.toThrow(
      HealthCheckError,
    );
  });
});
