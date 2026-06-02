import { Injectable, Inject } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import type { Knex } from 'knex';
import { KNEX_TOKEN } from '../database/database.providers.js';

@Injectable()
export class DbHealthIndicator extends HealthIndicator {
  constructor(@Inject(KNEX_TOKEN) private readonly knex: Knex) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.knex.raw('SELECT 1');
      return this.getStatus(key, true);
    } catch {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false),
      );
    }
  }
}
