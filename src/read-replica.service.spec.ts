import { Test, TestingModule } from '@nestjs/testing';
import { ReadReplicaService } from './read-replica.service';
import { REPLICA_DATA_SOURCE } from './read-replica.module';

function makeMockQueryRunner(overrides: Partial<{
  isReleased: boolean;
  connect: jest.Mock;
  release: jest.Mock;
}> = {}) {
  return {
    isReleased: overrides.isReleased ?? false,
    connect: overrides.connect ?? jest.fn().mockResolvedValue(undefined),
    release: overrides.release ?? jest.fn().mockResolvedValue(undefined),
    manager: {},
  };
}

function makeMockDataSource(queryRunner: any) {
  return {
    createQueryRunner: jest.fn().mockReturnValue(queryRunner),
  };
}

async function buildService(dataSource: any): Promise<ReadReplicaService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ReadReplicaService,
      { provide: REPLICA_DATA_SOURCE, useValue: dataSource },
    ],
  }).compile();

  // REQUEST scope requires instantiating manually for unit tests
  return module.resolve<ReadReplicaService>(ReadReplicaService);
}

describe('ReadReplicaService', () => {
  describe('getQueryRunner()', () => {
    it('creates a QueryRunner on first call using slave mode', async () => {
      const qr = makeMockQueryRunner();
      const ds = makeMockDataSource(qr);
      const service = await buildService(ds);

      const result = await service.getQueryRunner();

      expect(ds.createQueryRunner).toHaveBeenCalledWith('slave');
      expect(qr.connect).toHaveBeenCalledTimes(1);
      expect(result).toBe(qr);
    });

    it('reuses the existing runner on subsequent calls when not released', async () => {
      const qr = makeMockQueryRunner();
      const ds = makeMockDataSource(qr);
      const service = await buildService(ds);

      const first = await service.getQueryRunner();
      const second = await service.getQueryRunner();

      expect(ds.createQueryRunner).toHaveBeenCalledTimes(1);
      expect(qr.connect).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('recreates runner if existing runner isReleased is true', async () => {
      const qr = makeMockQueryRunner({ isReleased: true });
      const ds = makeMockDataSource(qr);
      const service = await buildService(ds);

      // Force first call — will create because queryRunner is null
      await service.getQueryRunner();
      // Mark it as released
      qr.isReleased = true;
      // Second call — should re-create
      await service.getQueryRunner();

      expect(ds.createQueryRunner).toHaveBeenCalledTimes(2);
      expect(qr.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('releaseQueryRunner()', () => {
    it('calls release() and nulls the internal reference', async () => {
      const qr = makeMockQueryRunner();
      const ds = makeMockDataSource(qr);
      const service = await buildService(ds);

      await service.getQueryRunner();
      await service.releaseQueryRunner();

      expect(qr.release).toHaveBeenCalledTimes(1);

      // After release, calling getQueryRunner() should create a new runner
      await service.getQueryRunner();
      expect(ds.createQueryRunner).toHaveBeenCalledTimes(2);
    });

    it('swallows QueryRunnerAlreadyReleasedError', async () => {
      const alreadyReleasedError = Object.assign(new Error('already released'), {
        name: 'QueryRunnerAlreadyReleasedError',
      });
      const qr = makeMockQueryRunner({
        release: jest.fn().mockRejectedValue(alreadyReleasedError),
      });
      const ds = makeMockDataSource(qr);
      const service = await buildService(ds);

      await service.getQueryRunner();

      await expect(service.releaseQueryRunner()).resolves.toBeUndefined();
    });

    it('re-throws unknown errors from release()', async () => {
      const unknownError = Object.assign(new Error('connection lost'), {
        name: 'ConnectionError',
      });
      const qr = makeMockQueryRunner({
        release: jest.fn().mockRejectedValue(unknownError),
      });
      const ds = makeMockDataSource(qr);
      const service = await buildService(ds);

      await service.getQueryRunner();

      await expect(service.releaseQueryRunner()).rejects.toThrow('connection lost');
    });

    it('is idempotent — safe to call twice', async () => {
      const qr = makeMockQueryRunner();
      const ds = makeMockDataSource(qr);
      const service = await buildService(ds);

      await service.getQueryRunner();
      await service.releaseQueryRunner();
      // Second call — queryRunner is null, should no-op
      await expect(service.releaseQueryRunner()).resolves.toBeUndefined();

      expect(qr.release).toHaveBeenCalledTimes(1);
    });

    it('does nothing if getQueryRunner was never called', async () => {
      const qr = makeMockQueryRunner();
      const ds = makeMockDataSource(qr);
      const service = await buildService(ds);

      await expect(service.releaseQueryRunner()).resolves.toBeUndefined();
      expect(qr.release).not.toHaveBeenCalled();
    });
  });
});
