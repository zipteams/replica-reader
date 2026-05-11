import { Injectable, Scope, Inject } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { REPLICA_DATA_SOURCE } from './read-replica.module';

@Injectable({ scope: Scope.REQUEST })
export class ReadReplicaService {
  private queryRunner: QueryRunner | null = null;

  constructor(
    @Inject(REPLICA_DATA_SOURCE) private readonly dataSource: any,
  ) {}

  async getQueryRunner(): Promise<QueryRunner> {
    if (!this.queryRunner || this.queryRunner.isReleased) {
      this.queryRunner = this.dataSource.createQueryRunner('slave');
      await this.queryRunner.connect();
    }

    return this.queryRunner;
  }

  async releaseQueryRunner(): Promise<void> {
    if (this.queryRunner && !this.queryRunner.isReleased) {
      try {
        await this.queryRunner.release();
        this.queryRunner = null;
      } catch (error) {
        if (error.name !== 'QueryRunnerAlreadyReleasedError') {
          throw error;
        }
        this.queryRunner = null;
      }
    }
  }
}
