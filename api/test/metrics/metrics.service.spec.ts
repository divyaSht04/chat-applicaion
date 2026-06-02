import { MetricsService } from '../../src/metrics/metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('creates a private registry', () => {
    expect(service.registry).toBeDefined();
  });

  it('registers httpRequestsTotal counter', () => {
    expect(service.httpRequestsTotal).toBeDefined();
  });

  it('registers httpRequestDuration histogram', () => {
    expect(service.httpRequestDuration).toBeDefined();
  });

  it('each instance has an independent registry', () => {
    const service2 = new MetricsService();
    expect(service.registry).not.toBe(service2.registry);
  });

  it('registry metrics output contains expected metric names', async () => {
    const output = await service.registry.metrics();
    expect(output).toContain('http_requests_total');
    expect(output).toContain('http_request_duration_seconds');
  });
});
