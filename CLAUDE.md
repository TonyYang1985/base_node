# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@gaias/basenode` is a Node.js API development framework built on Koa, TypeORM, TypeDI, and routing-controllers. It provides a microframework architecture with built-in support for RESTful APIs, WebSocket controllers, database ORM, distributed events via RabbitMQ, Redis caching, and API gateway integration with APISIX.

## Development Commands

### Running the Application
```bash
# Development mode with hot reload
yarn dev

# Development mode with API gateway enabled (production-like)
yarn devPro

# Run compiled example app using ncc
yarn ncc:run
```

### Building
```bash
# Build for publishing (transpiles src/ to dist/)
yarn prepublish

# Build single-file executable with ncc
yarn ncc:build
```

### Linting
```bash
# Type check and lint
yarn lint

# Auto-fix linting issues
yarn lint:fix
```

### Database Code Generation

The framework includes automated code generation tools for database entities and repositories:

```bash
# Generate entities from database schema
yarn gen:db-schema

# Generate repository classes from entities
yarn gen:db-repo

# Generate both entities and repositories, then fix linting
yarn gen:db

# Generate index.ts files for all modules
yarn gen:idx
```

**Important:** Before running database generation:
1. Ensure MariaDB/MySQL is running and accessible
2. Configure database connection in `cfg/database.yml`
3. Define which tables to generate in `gen_db.json` (array of table names)

The generators use `typeorm-model-generator` with custom Mustache templates (`tools/repository.mst`) to create:
- **Entities** in `example/entities/` (or configured output path)
- **Repositories** in `example/repositories/` with `Repo` suffix

Generated repositories extend `BaseRepository<T>` and won't be overwritten if they already exist.

### Other Commands
```bash
# Update dependencies to latest versions
yarn upver

# Generate RSA keys for JWT (stored in ./keys/)
yarn gen:keys

# Update build number
yarn buildNum
```

## Architecture

### Bootstrap System

The application uses a microframework loader pattern orchestrated by `src/server/bootstrap.ts`. The bootstrap function accepts a `BootstrapOption` that combines multiple loader configurations and sequentially initializes:

1. **TypeORM Loader** - Database connection and entity registration
2. **Redis Loader** - Redis client initialization
3. **RabbitMQ Loader** - Distributed event system setup
4. **Koa Loader** - Web server with RESTful and WebSocket controllers
5. **API Gateway Loader** - APISIX integration for service registration

Each loader can be disabled via flags (`disableDatabase`, `disableRedis`, `disableEvent`).

### Configuration Management

Configuration is managed through YAML files in the `cfg/` directory, loaded by `ConfigManager`:

- `application.yml` - App name, version, port
- `database.yml` - MariaDB connection string
- `redis.yml` - Redis connection settings
- `rabbitmq.yml` - RabbitMQ connection URL
- `logger.yml` - Pino logger configuration
- `apisix.yml` - API gateway settings

Configuration files support environment-specific overrides (e.g., `application.development.yml`). Access config via:
```typescript
ConfigManager.getConfig<ApplicationConfig>('application')
```

### Dependency Injection

The framework uses TypeDI for IoC. Services and repositories are decorated with `@Service()` and injected via `@Inject()` or constructor injection. The `Container` is automatically configured during bootstrap.

### Controller Pattern

**RESTful Controllers** extend `UniversalController` and use `routing-controllers` decorators:
- `@JsonController()` - Define controller class
- `@Get()`, `@Post()`, `@Put()`, `@Delete()` - HTTP methods with optional scopes
- Method signature: `@Method(path, scope?, module?)`
- `UniversalController` provides CRUD operations for entities via `getUniversalService(Entity)`

**WebSocket Controllers** use `socket-controllers`:
- Use `@OnConnect`, `@OnDisconnect`, `@OnMessage` decorators
- Registered via `wsControllers` in bootstrap options

### Data Layer

**Entities** are TypeORM entities with decorators (`@Entity`, `@Column`, `@PrimaryGeneratedColumn`, etc.). Auto-generated from database schema.

**Repositories** extend `BaseRepository<Entity>` providing:
- `find()`, `findOne()`, `findById()`
- `save()`, `update()`, `delete()`

**UniversalService** provides high-level CRUD with transformation:
- `create()`, `readById()`, `update()`, `remove()`
- `getAll(VoClass)`, `query(search, options)` - With pagination support
- Automatic VO transformation using `class-transformer`

### Validation and Transformation

Use `class-validator` decorators on VO (Value Object) classes wrapped with `@i18n()` for internationalized error messages:
```typescript
class UserVo {
  @i18n(IsString)
  @i18n(MaxLength, 50)
  userName: string;
}
```

Transform responses with `@Transform(VoClass)` decorator on controller methods.

### Caching

Two-level caching system:

**L1 Cache** - In-memory with TTL:
```typescript
@Get('/path')
@L1Cache({ ttlSeconds: 60 })
async method() { }
```

**L2 Cache** - Redis-backed via `CacheService`:
```typescript
@Inject()
private cacheService: CacheService;

await this.cacheService.set('key', value, ttl);
await this.cacheService.get('key');
```

### Distributed Events

RabbitMQ-based pub/sub system via `DistributedEvents`:

**Publishing events:**
```typescript
events.pub('eventName', { data });
```

**Subscribing to events:**
```typescript
events.sub(['event.pattern.*']);
events.on('RemoteEvent', (eventName, data) => { });
```

Event handlers are classes decorated with `@Service()` registered in `eventsHandlers` bootstrap option.

### Leader Election

Redis-based leader election for distributed systems using the `Leader` service:
```typescript
await Container.get(Leader).config({ project: 'ProjectName' }).elect();
```

Emits `elected` and `revoked` events. Useful for scheduled tasks that should only run on one instance.

### API Gateway Integration

Automatic service registration with APISIX when `ENABLE_API_GATEWAY=true`. Routes are auto-discovered and registered with the gateway on startup.

### Error Handling

Use `BizError` for business logic errors with i18n support:
```typescript
throw new BizError('error.key');
// or with params
throw new BizError({ key: 'error.key', param: { name: 'value' } });
```

Use `ValidationHelper.check()` for custom validation logic.

### Logging

Pino-based logging via `Logger.getLogger(context)`:
```typescript
private logger = Logger.getLogger(MyClass);
this.logger.info('message');
this.logger.error('error', err);
```

## TypeScript Configuration

- Outputs to `temp/` during development
- Uses path alias `@/*` for `src/*`
- Decorators enabled (`experimentalDecorators`, `emitDecoratorMetadata`)
- Strict mode enabled

## Testing

The framework expects tests to be in `*.test.ts` or `*.spec.ts` files (excluded from compilation). Use Jest for testing (configured in devDependencies).

## Project Structure

```
src/
  libs/           # Framework components
    configure/    # Config management
    orm/          # TypeORM extensions (BaseRepository)
    koa/          # Koa server setup
    redis/        # Redis client
    rabbitmq/     # Distributed events
    cache/        # Caching service
    leader/       # Leader election
    universal/    # UniversalController/Service
    validator/    # Validation helpers
    logger/       # Logging
    gateway/      # APISIX integration
    error/        # Error handling
  server/         # Bootstrap logic
  utils/          # Utilities (JWT, crypto, YAML)

example/          # Example application
  app.ts          # Entry point
  controllers/    # RESTful controllers
  wsControllers/  # WebSocket controllers
  entities/       # TypeORM entities
  repositories/   # Repository classes
  services/       # Business logic services
  vo/             # Value Objects (DTOs)
  events/         # Event handlers

cfg/              # YAML configuration files
tools/            # Code generators
```

## Key Dependencies

- **Koa** - Web framework
- **routing-controllers** - Decorator-based routing
- **socket-controllers** - WebSocket controllers
- **TypeORM** - ORM with MySQL/MariaDB
- **TypeDI** - Dependency injection
- **class-validator** - DTO validation
- **class-transformer** - Object transformation
- **ioredis** - Redis client
- **amqplib** - RabbitMQ client
- **pino** - Logger

## Entry Point

Example app entry: `example/app.ts`

Import and call `bootstrap()` with configuration:
```typescript
bootstrap({
  restfulControllers: [...controllers],
  wsControllers: [...wsControllers],
  entities: [...entities],
  eventsHandlers: [...handlers],
})
```

## Publishing

This is a private npm package (`UNLICENSED`). Publishing requires authentication:
```bash
npm_config__auth=<base64_token> yarn publish --access restricted
```