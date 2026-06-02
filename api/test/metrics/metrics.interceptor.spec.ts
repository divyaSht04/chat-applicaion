import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { MetricsInterceptor } from '../../src/metrics/metrics.interceptor';
import { MetricsService } from '../../src/metrics/metrics.service';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let metricsService: MetricsService;

  function makeHttpContext(method = 'GET', path = '/test', statusCode = 200) {
    return {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ method, path }),
        getResponse: jest.fn().mockReturnValue({ statusCode }),
      }),
    } as unknown as ExecutionContext;
  }

  function makeWsContext() {
    return {
      getType: jest.fn().mockReturnValue('ws'),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    metricsService = new MetricsService();
    interceptor = new MetricsInterceptor(metricsService);
  });

  it('records counter and histogram on successful request', async () => {
    const incSpy = jest.spyOn(metricsService.httpRequestsTotal, 'inc');
    const observeSpy = jest.spyOn(
      metricsService.httpRequestDuration,
      'observe',
    );
    const ctx = makeHttpContext('GET', '/test', 200);
    const next: CallHandler = { handle: () => of({ data: 'ok' }) };

    // lastValueFrom awaits full teardown — finalize has already run by the time
    // this promise resolves, because finalize runs synchronously before the microtask.
    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(incSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: '/test',
      status: '200',
    });
    expect(observeSpy).toHaveBeenCalledWith(
      { method: 'GET', path: '/test', status: '200' },
      expect.any(Number),
    );
  });

  it('still records metrics when the handler throws', async () => {
    const incSpy = jest.spyOn(metricsService.httpRequestsTotal, 'inc');
    const ctx = makeHttpContext('POST', '/fail', 500);
    const next: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      lastValueFrom(interceptor.intercept(ctx, next)),
    ).rejects.toThrow('boom');

    expect(incSpy).toHaveBeenCalled();
  });

  it('passes through non-HTTP contexts without recording', async () => {
    const incSpy = jest.spyOn(metricsService.httpRequestsTotal, 'inc');
    const ctx = makeWsContext();
    const next: CallHandler = { handle: () => of('ws-data') };

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(incSpy).not.toHaveBeenCalled();
  });
});
