# @zipteams/replica-reader

> Request-scoped TypeORM read-replica connection manager for NestJS. One QueryRunner per request, auto-released when the request completes.

## The Problem

TypeORM's built-in `replication` config blindly routes all SELECT queries to the slave. This creates two issues:
1. **Read-after-write inconsistency** — you write to master, immediately read from slave, get stale data
2. **No per-request control** — you can't selectively use the replica for expensive read-heavy endpoints

## How It Works

`ReadReplicaService` is `Scope.REQUEST` — each HTTP request gets its own instance with its own lazy-initialized `QueryRunner` pointed at the slave DataSource. `QueryRunnerReleaseInterceptor` uses RxJS `finalize()` to release the connection after the response is sent, whether it succeeded or errored.

## Installation

```bash
npm install @zipteams/replica-reader
```

## Quick Start

### 1. Register the module

```typescript
// app.module.ts
import { ReadReplicaModule } from '@zipteams/replica-reader';

@Module({
  imports: [
    ReadReplicaModule.forRoot({
      dataSource: slaveDataSource, // your TypeORM slave DataSource
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

### 2. Use in a service

```typescript
import { ReadReplicaService } from '@zipteams/replica-reader';

@Injectable()
export class UserService {
  constructor(private readonly replica: ReadReplicaService) {}

  async findAll(): Promise<User[]> {
    const qr = await this.replica.getQueryRunner();
    return qr.manager.find(User);
    // QueryRunner auto-released by interceptor — no manual cleanup needed
  }
}
```

### 3. Add the interceptor (per-controller or globally)

```typescript
// Per controller
@UseInterceptors(QueryRunnerReleaseInterceptor)
@Controller('users')
export class UserController {}

// Or globally in main.ts
app.useGlobalInterceptors(new QueryRunnerReleaseInterceptor(readReplicaService));
```

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dataSource` | `DataSource` | Yes | TypeORM DataSource configured with replica |
| `isGlobal` | `boolean` | No (default: `false`) | Register module globally |

## Multi-DB Setup

```typescript
ReadReplicaModule.forRoot({
  dataSource: analyticsSlaveDataSource,
  isGlobal: false,
})
```

Import into the specific module that needs analytics reads.

## API

### `ReadReplicaService`

| Method | Returns | Description |
|--------|---------|-------------|
| `getQueryRunner()` | `Promise<QueryRunner>` | Lazily creates and caches QueryRunner for current request |
| `releaseQueryRunner()` | `Promise<void>` | Releases and nulls the QueryRunner. Safe to call multiple times. |

### `QueryRunnerReleaseInterceptor`

NestJS interceptor. Apply with `@UseInterceptors(QueryRunnerReleaseInterceptor)`. Calls `releaseQueryRunner()` in `finalize()` — guaranteed to run after response, even on error.

## Why Not TypeORM Replication Config?

| | TypeORM built-in replication | @zipteams/replica-reader |
|---|---|---|
| Per-request control | No — all SELECTs go to slave | Yes — you choose which queries |
| Read-after-write safety | No | Yes — use master for critical reads |
| Connection lifecycle | Managed by pool | Per-request, explicit release |
| Multi-replica routing | Not supported | Bring your own DataSource |

## License

MIT
