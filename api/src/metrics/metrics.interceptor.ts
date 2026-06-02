import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context
      .switchToHttp()
      .getRequest<{ method: string; path: string }>();
    const start = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const res = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        const duration = (Date.now() - start) / 1000;
        const labels = {
          method: req.method,
          path: req.path,
          status: String(res.statusCode),
        };
        this.metricsService.httpRequestsTotal.inc(labels);
        this.metricsService.httpRequestDuration.observe(labels, duration);
      }),
    );
  }
}
