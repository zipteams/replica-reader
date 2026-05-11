import { DynamicModule, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReadReplicaService } from './read-replica.service';

export const REPLICA_DATA_SOURCE = 'REPLICA_DATA_SOURCE';

export interface ReadReplicaModuleOptions {
  dataSource: DataSource;
  isGlobal?: boolean;
}

@Module({})
export class ReadReplicaModule {
  static forRoot(options: ReadReplicaModuleOptions): DynamicModule {
    return {
      module: ReadReplicaModule,
      global: options.isGlobal ?? false,
      providers: [
        { provide: REPLICA_DATA_SOURCE, useValue: options.dataSource },
        ReadReplicaService,
      ],
      exports: [ReadReplicaService],
    };
  }
}
