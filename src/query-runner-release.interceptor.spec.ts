import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { QueryRunnerReleaseInterceptor } from './query-runner-release.interceptor';
import { ReadReplicaService } from './read-replica.service';

function makeMockReadReplicaService(): jest.Mocked<Pick<ReadReplicaService, 'releaseQueryRunner'>> {
  return {
    releaseQueryRunner: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMockExecutionContext(): ExecutionContext {
  return {} as ExecutionContext;
}

function makeMockCallHandler(observable: any): CallHandler {
  return {
    handle: () => observable,
  };
}

describe('QueryRunnerReleaseInterceptor', () => {
  it('calls releaseQueryRunner() after observable completes successfully', (done) => {
    const service = makeMockReadReplicaService();
    const interceptor = new QueryRunnerReleaseInterceptor(service as any);

    const ctx = makeMockExecutionContext();
    const handler = makeMockCallHandler(of('response'));

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        // finalize runs async, give it a tick
        setImmediate(() => {
          expect(service.releaseQueryRunner).toHaveBeenCalledTimes(1);
          done();
        });
      },
      error: done,
    });
  });

  it('calls releaseQueryRunner() even when the observable errors (finalize semantics)', (done) => {
    const service = makeMockReadReplicaService();
    const interceptor = new QueryRunnerReleaseInterceptor(service as any);

    const ctx = makeMockExecutionContext();
    const handler = makeMockCallHandler(throwError(() => new Error('upstream error')));

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        setImmediate(() => {
          expect(service.releaseQueryRunner).toHaveBeenCalledTimes(1);
          done();
        });
      },
    });
  });

  it('does not swallow the original error from the observable', (done) => {
    const service = makeMockReadReplicaService();
    const interceptor = new QueryRunnerReleaseInterceptor(service as any);

    const ctx = makeMockExecutionContext();
    const upstreamError = new Error('upstream error');
    const handler = makeMockCallHandler(throwError(() => upstreamError));

    interceptor.intercept(ctx, handler).subscribe({
      error: (err) => {
        expect(err).toBe(upstreamError);
        done();
      },
    });
  });

  it('passes response values through unchanged', (done) => {
    const service = makeMockReadReplicaService();
    const interceptor = new QueryRunnerReleaseInterceptor(service as any);

    const ctx = makeMockExecutionContext();
    const handler = makeMockCallHandler(of({ id: 1, name: 'test' }));
    const received: any[] = [];

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => received.push(val),
      complete: () => {
        expect(received).toEqual([{ id: 1, name: 'test' }]);
        done();
      },
    });
  });
});
