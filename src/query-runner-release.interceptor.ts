import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ReadReplicaService } from './read-replica.service';

@Injectable()
export class QueryRunnerReleaseInterceptor implements NestInterceptor {
  constructor(private readonly readReplicaService: ReadReplicaService) {}

  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      finalize(async () => {
        try {
          await this.readReplicaService.releaseQueryRunner();
        } catch (error) {
          console.error('Error releasing QueryRunner in interceptor:', error);
        }
      }),
    );
  }
}
