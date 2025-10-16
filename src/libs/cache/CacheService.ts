/**
 * 两级缓存服务 / Two-Level Cache Service
 *
 * 功能说明 / Description:
 * 提供 L1（内存）+ L2（Redis）两级缓存架构，支持 TTL、分布式同步和装饰器
 * Provides L1 (memory) + L2 (Redis) two-level cache architecture with TTL, distributed sync, and decorators
 *
 * 主要功能 / Main Features:
 * 1. L1 缓存 - 进程内存缓存，访问速度极快（微秒级）
 *    L1 Cache - In-process memory cache, extremely fast access (microseconds)
 * 2. L2 缓存 - Redis 缓存，跨进程共享（毫秒级）
 *    L2 Cache - Redis cache, cross-process sharing (milliseconds)
 * 3. TTL 支持 - 可配置的缓存过期时间
 *    TTL Support - Configurable cache expiration time
 * 4. 分布式同步 - 通过 Redis Pub/Sub 同步 L1 缓存
 *    Distributed Sync - Sync L1 cache via Redis Pub/Sub
 * 5. 装饰器支持 - @L1Cache 和 @L2Cache 方法装饰器
 *    Decorator Support - @L1Cache and @L2Cache method decorators
 *
 * 缓存架构 / Cache Architecture:
 * ```
 * ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 * │  Process 1  │     │  Process 2  │     │  Process 3  │
 * │ ┌─────────┐ │     │ ┌─────────┐ │     │ ┌─────────┐ │
 * │ │ L1 Cache│ │◄────┼─┤ L1 Cache│─┼────►│ │ L1 Cache│ │
 * │ └─────────┘ │     │ └─────────┘ │     │ └─────────┘ │
 * │      ▲      │     │      ▲      │     │      ▲      │
 * │      │      │     │      │      │     │      │      │
 * └──────┼──────┘     └──────┼──────┘     └──────┼──────┘
 *        │                   │                   │
 *        │    Redis Pub/Sub (CacheServiceEvent)  │
 *        └───────────────────┼───────────────────┘
 *                            ▼
 *                   ┌─────────────────┐
 *                   │  Redis (L2)     │
 *                   │  CacheService:* │
 *                   └─────────────────┘
 * ```
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { CacheService, L1Cache, L2Cache } from './libs/cache';
 * import { Service, Inject } from 'typedi';
 *
 * @Service()
 * class UserService {
 *   @Inject()
 *   private cacheService: CacheService;
 *
 *   // 方式 1: 装饰器方式（推荐）/ Method 1: Decorator (recommended)
 *   @L1Cache({ ttlSeconds: 60 })
 *   async getUserById(id: string) {
 *     return await this.db.findUser(id);
 *   }
 *
 *   // 方式 2: 手动方式 / Method 2: Manual
 *   async getUserProfile(id: string) {
 *     return this.cacheService.getL2({ userId: id }, async () => {
 *       return await this.db.findProfile(id);
 *     }, 300);
 *   }
 *
 *   // 清除缓存 / Clear cache
 *   async updateUser(id: string, data: any) {
 *     await this.db.update(id, data);
 *     await this.cacheService.reset({ userId: id });
 *   }
 * }
 * ```
 *
 * 性能对比 / Performance Comparison:
 * - L1 缓存命中：~0.01ms（内存访问）
 *   L1 cache hit: ~0.01ms (memory access)
 * - L2 缓存命中：~1-5ms（Redis 网络往返）
 *   L2 cache hit: ~1-5ms (Redis network roundtrip)
 * - 缓存未命中：取决于数据源（可能 10-1000ms+）
 *   Cache miss: depends on data source (may be 10-1000ms+)
 *
 * 最佳实践 / Best Practices:
 * - 高频访问的小数据使用 L1 缓存（如配置、常量）
 *   Use L1 cache for frequently accessed small data (e.g., config, constants)
 * - 中频访问的大数据使用 L2 缓存（如用户信息、列表）
 *   Use L2 cache for medium-frequency large data (e.g., user info, lists)
 * - 数据更新时及时调用 reset() 清除缓存
 *   Call reset() promptly when data is updated to clear cache
 * - 合理设置 TTL，避免内存溢出
 *   Set reasonable TTL to avoid memory overflow
 */
import Redis from 'ioredis';
import _ from 'lodash';
import Container, { Service } from 'typedi';
import { Logger } from '../logger';
import { RedisClient } from '../redis';
import { fmkTimer } from './Timer';
import { ClassType } from '../type';

/**
 * 数据提供者类型 / Data Provider Type
 * 用于懒加载数据的回调函数
 * Callback function for lazy loading data
 *
 * @template T 返回的数据类型 / Return data type
 * @template P 参数类型 / Parameter type
 */
export type DataProvider<T, P = any> = (parma?: P) => T | Promise<T>;

/**
 * 对象路径替换配置 / Object Path Replace Configuration
 * 用于 applyCache 函数的路径配置
 * Path configuration for applyCache function
 */
export type ReplaceObjectPath = { id?: string; value?: string };

/**
 * 完整对象路径配置 / Full Object Path Configuration
 * value 字段为必填
 * value field is required
 */
export type ReplaceObjectPathFull = { id?: string; value: string };

/**
 * L1 缓存 TTL 信息 / L1 Cache TTL Information
 * 记录缓存创建时间和过期时间
 * Records cache creation time and expiration time
 */
export type L1TTL = { createdAt: number; ttl: number };

/**
 * 缓存服务事件 / Cache Service Event
 * Redis Pub/Sub 消息格式
 * Redis Pub/Sub message format
 */
export type CacheServiceEvent = {
  /** 事件类型 / Event type */
  event: string;
  /** 事件参数 / Event parameter */
  param: any;
  /** 事件值（可选）/ Event value (optional) */
  value?: any;
} & Partial<L1TTL>;

/**
 * 缓存同步器类型 / Cache Synchronizer Type
 * 用于自定义缓存同步逻辑（预留接口）
 * For custom cache synchronization logic (reserved interface)
 */
export type CacheSynconizer = (key: string, updaterName: string, val: any) => any;

/**
 * 缓存服务事件常量 / Cache Service Event Constants
 */
export const CacheServiceEvents = {
  /** 重置缓存事件 / Reset cache event */
  REST: 'REST',
  /** L1 缓存更新事件 / L1 cache update event */
  L1_UPDATE: 'L1_UPDATE',
};

/**
 * L1 缓存存储 / L1 Cache Storage
 * 进程内存中的缓存数据
 * Cache data in process memory
 */
const levelOneCache: any = {};

/**
 * L1 缓存 TTL 记录 / L1 Cache TTL Records
 * 记录每个缓存的创建时间和过期时间
 * Records creation and expiration time for each cache
 */
const levelOneCacheTTL: Record<any, L1TTL> = {};

/**
 * L1 缓存定义 / L1 Cache Definitions
 * 保存 L1 缓存的数据提供者函数
 * Stores data provider functions for L1 cache
 */
const l1Definitions: Record<string, DataProvider<any, any>> = {};

/**
 * L2 缓存定义 / L2 Cache Definitions
 * 保存 L2 缓存的数据提供者函数
 * Stores data provider functions for L2 cache
 */
const l2Definitions: Record<string, DataProvider<any, any>> = {};

/**
 * 获取 Redis 缓存键 / Get Redis Cache Key
 * 为缓存键添加统一前缀，避免与其他 Redis 键冲突
 * Adds uniform prefix to cache keys to avoid conflicts with other Redis keys
 *
 * @param key 原始缓存键 / Original cache key
 * @returns 带前缀的 Redis 键 / Prefixed Redis key
 */
const getCacheServiceKey = (key: string) => `CacheService:${key}`;

/**
 * 缓存服务类 / Cache Service Class
 *
 * 架构说明 / Architecture:
 * - L1 缓存：使用进程内存（levelOneCache 对象）
 *   L1 Cache: Uses process memory (levelOneCache object)
 * - L2 缓存：使用 Redis 存储（CacheService:* 键）
 *   L2 Cache: Uses Redis storage (CacheService:* keys)
 * - 同步机制：Redis Pub/Sub 频道 'CacheServiceEvent'
 *   Sync mechanism: Redis Pub/Sub channel 'CacheServiceEvent'
 * - TTL 检查：通过 Timer 定期清理过期的 L1 缓存
 *   TTL check: Periodically clean expired L1 cache via Timer
 *
 * 生命周期 / Lifecycle:
 * 1. 构造函数创建两个 Redis 连接（订阅 + 操作）
 *    Constructor creates two Redis connections (subscribe + operations)
 * 2. 订阅 CacheServiceEvent 频道监听缓存事件
 *    Subscribe to CacheServiceEvent channel to listen for cache events
 * 3. 启动定时器定期检查 L1 缓存过期
 *    Start timer to periodically check L1 cache expiration
 */
@Service()
export class CacheService {
  /** 日志记录器 / Logger instance */
  logger = Logger.getLogger(CacheService);

  /**
   * 构造函数 / Constructor
   *
   * @param redisClient Redis 客户端实例 / Redis client instance
   *
   * 说明 / Description:
   * 创建两个独立的 Redis 连接：
   * Creates two independent Redis connections:
   * - redisSub: 专用于 Pub/Sub 订阅（避免阻塞）
   *   Dedicated for Pub/Sub subscription (avoid blocking)
   * - redis: 用于普通 Redis 操作（GET/SET/DEL）
   *   For normal Redis operations (GET/SET/DEL)
   */
  constructor(private redisClient: RedisClient) {
    this.startCacheService(redisClient.newClient(), redisClient.newClient());
  }

  /**
   * 启动缓存服务 / Start Cache Service
   *
   * @param redisSub Redis 订阅客户端 / Redis subscription client
   * @param redis Redis 操作客户端 / Redis operations client
   *
   * 功能说明 / Description:
   * 初始化分布式缓存同步系统，监听缓存事件
   * Initializes distributed cache sync system, listens for cache events
   *
   * 事件处理 / Event Handling:
   * - REST: 重置指定键的 L1 和 L2 缓存
   *   Reset L1 and L2 cache for specified key
   * - L1_UPDATE: 更新指定键的 L1 缓存
   *   Update L1 cache for specified key
   *
   * 定时任务 / Scheduled Task:
   * 每秒检查一次 L1 缓存过期情况
   * Check L1 cache expiration every second
   */
  public startCacheService(redisSub: Redis, redis: Redis) {
    // 订阅 CacheServiceEvent 频道 / Subscribe to CacheServiceEvent channel
    redisSub.subscribe('CacheServiceEvent', (err) => {
      if (err) {
        this.logger.error(err.message);
      } else {
        this.logger.info(`🚀CacheService level 2 cache(redis) subscribed successfully!`);
      }
    });

    // 监听缓存事件消息 / Listen for cache event messages
    redisSub.on('message', (__, message: string) => {
      const logger = Logger.getLogger(CacheService);
      const { event, param, value, ttl, createdAt }: CacheServiceEvent = JSON.parse(message);

      // 处理重置缓存事件 / Handle reset cache event
      if (event === CacheServiceEvents.REST) {
        // 删除 L1 缓存 / Delete L1 cache
        if (levelOneCache[param]) {
          delete levelOneCache[param];
          delete levelOneCacheTTL[param];
          logger.info('Reset level 1 cache: %s', param);
        }
        // 删除 L2 缓存 / Delete L2 cache
        redis.del(getCacheServiceKey(param)).then((n) => {
          if (n > 0) logger.info('Reset level 2 cache: %s', param);
        });
      }

      // 处理 L1 缓存更新事件 / Handle L1 cache update event
      if (event === CacheServiceEvents.L1_UPDATE) {
        levelOneCache[param] = value;
        // 如果有 TTL，记录过期时间 / If TTL exists, record expiration time
        if (ttl && createdAt) {
          levelOneCacheTTL[param] = {
            ttl,
            createdAt,
          };
        }
        logger.info('Update level 1 cache: %s', param);
      }
    });

    // 注册定时器，每秒检查 L1 缓存过期 / Register timer to check L1 cache expiration every second
    fmkTimer.onTimer('CacheService:CacheChecker', () => {
      const now = Date.now();
      // 找出所有过期的缓存键 / Find all expired cache keys
      Object.keys(levelOneCacheTTL)
        .filter((key) => {
          const { createdAt, ttl } = levelOneCacheTTL[key];
          return createdAt + ttl * 1000 < now; // 检查是否过期 / Check if expired
        })
        .forEach((key) => {
          // 删除过期缓存 / Delete expired cache
          delete levelOneCache[key];
          delete levelOneCacheTTL[key];
        });
    });
  }

  /**
   * 重置缓存 / Reset Cache
   *
   * @param param 缓存参数（用于生成缓存键）/ Cache parameter (used to generate cache key)
   *
   * 功能说明 / Description:
   * 向所有进程广播重置缓存事件，清除 L1 和 L2 缓存
   * Broadcasts reset cache event to all processes to clear L1 and L2 cache
   *
   * 使用场景 / Use Cases:
   * - 数据更新后清除缓存 / Clear cache after data update
   * - 强制刷新缓存 / Force cache refresh
   *
   * 示例 / Example:
   * ```typescript
   * // 用户信息更新后清除缓存 / Clear cache after user info update
   * await this.cacheService.reset({ userId: '123' });
   * ```
   */
  async reset<P>(param: P) {
    await this.redisClient.redis.publish('CacheServiceEvent', JSON.stringify({ event: CacheServiceEvents.REST, param: JSON.stringify(param) }));
  }

  /**
   * 创建 L1 缓存数据提供者 / Create L1 Cache Data Provider
   *
   * @param param 缓存参数 / Cache parameter
   * @param provider 数据提供者函数 / Data provider function
   * @param ttlSeconds TTL（秒），可选 / TTL in seconds, optional
   * @returns 带缓存的数据提供者 / Data provider with caching
   *
   * 功能说明 / Description:
   * 返回一个懒加载函数，首次调用时获取数据并缓存到 L1
   * Returns a lazy-loading function that fetches data on first call and caches to L1
   *
   * 缓存策略 / Caching Strategy:
   * 1. 检查 L1 缓存是否存在 / Check if L1 cache exists
   * 2. 不存在则调用 provider 获取数据 / If not, call provider to fetch data
   * 3. 通过 Redis Pub/Sub 广播到所有进程 / Broadcast to all processes via Redis Pub/Sub
   * 4. 所有进程更新本地 L1 缓存 / All processes update local L1 cache
   *
   * 示例 / Example:
   * ```typescript
   * const getCfg = cacheService.L1({ key: 'app-config' }, async () => {
   *   return await loadConfigFromDB();
   * }, 300);
   *
   * const config = await getCfg(); // 第一次调用加载数据 / First call loads data
   * const config2 = await getCfg(); // 后续调用返回缓存 / Subsequent calls return cache
   * ```
   */
  L1<T, P>(param: P, provider: DataProvider<T, P>, ttlSeconds?: number): DataProvider<T, P> {
    l1Definitions[JSON.stringify(param)] = provider; // 保存数据提供者定义 / Save data provider definition
    return async (parma?: P): Promise<T> => {
      const key = JSON.stringify(parma);
      let value = levelOneCache[key]; // 检查 L1 缓存 / Check L1 cache

      if (_.isNil(value)) {
        // L1 缓存未命中，调用 provider 获取数据 / L1 cache miss, call provider to fetch data
        value = await Promise.resolve(provider(parma));
        if (!_.isNil(value)) {
          // 广播 L1 缓存更新事件 / Broadcast L1 cache update event
          if (ttlSeconds) {
            // 带 TTL 的缓存 / Cache with TTL
            await this.redisClient.redis.publish(
              'CacheServiceEvent',
              JSON.stringify({
                event: CacheServiceEvents.L1_UPDATE,
                param: key,
                value,
                createdAt: Date.now(),
                ttl: ttlSeconds,
              } as CacheServiceEvent),
            );
          } else {
            // 永久缓存（无 TTL）/ Permanent cache (no TTL)
            await this.redisClient.redis.publish(
              'CacheServiceEvent',
              JSON.stringify({
                event: CacheServiceEvents.L1_UPDATE,
                param: key,
                value,
              } as CacheServiceEvent),
            );
          }
        }
      }
      return value;
    };
  }

  /**
   * 获取 L1 缓存数据（快捷方法）/ Get L1 Cache Data (Shortcut Method)
   *
   * @param param 缓存参数 / Cache parameter
   * @param provider 数据提供者 / Data provider
   * @param expire TTL（秒）/ TTL in seconds
   * @returns 缓存数据 / Cached data
   *
   * 功能说明 / Description:
   * L1() 方法的快捷版本，直接返回数据而不是数据提供者
   * Shortcut version of L1() that returns data directly instead of data provider
   */
  async getL1<T, P>(param: P, provider: DataProvider<T, P>, expire?: number) {
    return this.L1(param, provider, expire)(param);
  }

  /**
   * 创建 L2 缓存数据提供者 / Create L2 Cache Data Provider
   *
   * @param param 缓存参数 / Cache parameter
   * @param provider 数据提供者函数 / Data provider function
   * @param ttlSeconds TTL（秒），可选 / TTL in seconds, optional
   * @returns 带缓存的数据提供者 / Data provider with caching
   *
   * 功能说明 / Description:
   * 返回一个懒加载函数，首次调用时获取数据并缓存到 Redis (L2)
   * Returns a lazy-loading function that fetches data on first call and caches to Redis (L2)
   *
   * 缓存策略 / Caching Strategy:
   * 1. 检查 Redis 缓存是否存在 / Check if Redis cache exists
   * 2. 不存在则调用 provider 获取数据 / If not, call provider to fetch data
   * 3. 将数据存储到 Redis / Store data to Redis
   * 4. 如果指定 TTL，设置过期时间 / If TTL specified, set expiration
   *
   * 与 L1 的区别 / Difference from L1:
   * - L2 缓存跨进程共享，不需要 Pub/Sub 同步
   *   L2 cache is shared across processes, no Pub/Sub sync needed
   * - L2 缓存访问较慢（网络 IO），适合中频访问场景
   *   L2 cache access is slower (network IO), suitable for medium-frequency scenarios
   *
   * 示例 / Example:
   * ```typescript
   * const getUser = cacheService.L2({ userId: '123' }, async () => {
   *   return await userRepo.findById('123');
   * }, 600);
   *
   * const user = await getUser(); // 从数据库加载 / Load from database
   * const user2 = await getUser(); // 从 Redis 返回 / Return from Redis
   * ```
   */
  L2<T, P>(param: P, provider: DataProvider<T, P>, ttlSeconds?: number): DataProvider<T, P> {
    l2Definitions[JSON.stringify(param)] = provider; // 保存数据提供者定义 / Save data provider definition
    return async (parma?: P): Promise<T> => {
      const key = getCacheServiceKey(JSON.stringify(parma));
      const valueStr = await this.redisClient.redis.get(key); // 检查 L2 缓存 / Check L2 cache

      if (_.isNil(valueStr)) {
        // L2 缓存未命中，调用 provider 获取数据 / L2 cache miss, call provider to fetch data
        const value = await Promise.resolve(provider(parma));
        if (!_.isNil(value)) {
          // 存储到 Redis / Store to Redis
          await this.redisClient.redis.set(key, JSON.stringify(value));
          // 如果指定 TTL，设置过期时间 / If TTL specified, set expiration
          if (ttlSeconds) {
            await this.redisClient.redis.expire(key, ttlSeconds);
          }
        }
        return value;
      } else {
        // L2 缓存命中，反序列化并返回 / L2 cache hit, deserialize and return
        return JSON.parse(valueStr);
      }
    };
  }

  /**
   * 获取 L2 缓存数据（快捷方法）/ Get L2 Cache Data (Shortcut Method)
   *
   * @param param 缓存参数 / Cache parameter
   * @param provider 数据提供者 / Data provider
   * @param expire TTL（秒）/ TTL in seconds
   * @returns 缓存数据 / Cached data
   *
   * 功能说明 / Description:
   * L2() 方法的快捷版本，直接返回数据而不是数据提供者
   * Shortcut version of L2() that returns data directly instead of data provider
   */
  async getL2<T, P>(param: P, provider: DataProvider<T, P>, expire?: number) {
    return this.L2(param, provider, expire)(param);
  }

  /**
   * 创建缓存 / Create Cache
   *
   * @param key 缓存键 / Cache key
   * @param cb 数据回调函数 / Data callback function
   *
   * 功能说明 / Description:
   * 直接创建 L2 缓存，不检查是否已存在（会覆盖）
   * Directly creates L2 cache without checking existence (will overwrite)
   *
   * 使用场景 / Use Cases:
   * - 预热缓存 / Cache warming
   * - 强制更新缓存 / Force cache update
   */
  async createCache<T = any>(key: any, cb: () => T | Promise<T>) {
    const cacheKey = JSON.stringify(key);
    const cacheData = await Promise.resolve(cb());
    if (!_.isNil(cacheData)) {
      await this.redisClient.redis.set(getCacheServiceKey(cacheKey), JSON.stringify(cacheData));
    }
  }

  /**
   * 更新缓存 / Update Cache
   *
   * @param key 缓存键 / Cache key
   * @param cb 更新回调函数，接收当前值并返回新值 / Update callback that receives current value and returns new value
   *
   * 功能说明 / Description:
   * 读取当前缓存值，调用回调函数生成新值，然后更新缓存
   * Reads current cache value, calls callback to generate new value, then updates cache
   *
   * 使用场景 / Use Cases:
   * - 基于当前值的增量更新 / Incremental update based on current value
   * - 条件更新缓存 / Conditional cache update
   *
   * 示例 / Example:
   * ```typescript
   * // 增加访问计数 / Increment view count
   * await cacheService.updateCache({ pageId: '123' }, (current) => {
   *   return { ...current, views: (current?.views || 0) + 1 };
   * });
   * ```
   */
  async updateCache<T = any>(key: any, cb: (currentVal?: T) => (T | undefined) | Promise<T | undefined>) {
    const cacheKey = JSON.stringify(key);
    const redisCacheKey = getCacheServiceKey(cacheKey);
    // 读取当前缓存值 / Read current cache value
    const currentDataStr = await this.redisClient.redis.get(redisCacheKey);
    const currentData = JSON.parse(currentDataStr ?? 'null');
    // 调用回调函数生成新值 / Call callback to generate new value
    const cacheData = await Promise.resolve(cb(currentData ?? undefined));
    if (!_.isNil(cacheData)) {
      // 更新缓存 / Update cache
      await this.redisClient.redis.set(redisCacheKey, JSON.stringify(cacheData));
    }
  }

  /**
   * 删除缓存 / Remove Cache
   *
   * @param key 缓存键 / Cache key
   *
   * 功能说明 / Description:
   * 从 Redis 删除指定的 L2 缓存
   * Deletes specified L2 cache from Redis
   *
   * 注意事项 / Notes:
   * - 只删除 L2 缓存，不影响 L1 缓存
   *   Only deletes L2 cache, does not affect L1 cache
   * - 如需删除 L1+L2，使用 reset() 方法
   *   Use reset() to delete both L1 and L2
   */
  async removeCache(key: any) {
    const cacheKey = JSON.stringify(key);
    const redisCacheKey = getCacheServiceKey(cacheKey);
    await this.redisClient.redis.del(redisCacheKey);
  }

  /**
   * 获取缓存 / Get Cache
   *
   * @param key 缓存键 / Cache key
   * @returns 缓存数据或 null / Cache data or null
   *
   * 功能说明 / Description:
   * 直接从 Redis 读取缓存，不触发数据提供者
   * Directly reads cache from Redis without triggering data provider
   *
   * 使用场景 / Use Cases:
   * - 检查缓存是否存在 / Check if cache exists
   * - 读取手动设置的缓存 / Read manually set cache
   */
  async getCache<T = any>(key: any) {
    const cacheKey = JSON.stringify(key);
    const redisCacheKey = getCacheServiceKey(cacheKey);
    const currentDataStr = await this.redisClient.redis.get(redisCacheKey);
    const currentData = JSON.parse(currentDataStr ?? 'null') as T | null;
    return currentData;
  }

  /**
   * 批量获取缓存 / Get Multiple Caches
   *
   * @param keys 缓存键数组 / Array of cache keys
   * @returns 缓存数据数组 / Array of cache data
   *
   * 功能说明 / Description:
   * 使用 Redis MGET 命令批量获取多个缓存
   * Uses Redis MGET command to fetch multiple caches in batch
   *
   * 性能优势 / Performance Advantage:
   * 一次网络往返获取多个键，比循环调用 getCache() 快
   * Fetches multiple keys in one network roundtrip, faster than looping getCache()
   *
   * 示例 / Example:
   * ```typescript
   * const keys = [{ userId: '1' }, { userId: '2' }, { userId: '3' }];
   * const users = await cacheService.getCaches<User>(keys);
   * // users: [User|null, User|null, User|null]
   * ```
   */
  async getCaches<T = any>(keys: any[]) {
    const cacheKeys = keys.map((key) => JSON.stringify(key));
    const redisCacheKeys = cacheKeys.map((cacheKey) => getCacheServiceKey(cacheKey));
    // 使用 MGET 批量获取 / Use MGET to fetch in batch
    const currentDataStrArray = await this.redisClient.redis.mget(redisCacheKeys);
    // 反序列化所有结果 / Deserialize all results
    const currentDataArray = currentDataStrArray.map((currentDataStr) => JSON.parse(currentDataStr ?? 'null') as T | null);
    return currentDataArray;
  }
}

/**
 * 创建缓存（全局函数）/ Create Cache (Global Function)
 *
 * @param key 缓存键 / Cache key
 * @param cb 数据回调 / Data callback
 *
 * 功能说明 / Description:
 * 全局快捷函数，无需注入 CacheService
 * Global shortcut function, no need to inject CacheService
 */
export const createCache = async <T = any>(key: any, cb: () => T | Promise<T>) => {
  const cacheService = Container.get(CacheService);
  await cacheService.createCache(key, cb);
};

/**
 * 更新缓存（全局函数）/ Update Cache (Global Function)
 * 全局快捷函数，无需注入 CacheService
 * Global shortcut function, no need to inject CacheService
 */
export const updateCache = async <T = any>(key: any, cb: (currentVal?: T) => (T | undefined) | Promise<T | undefined>) => {
  const cacheService = Container.get(CacheService);
  await cacheService.updateCache(key, cb);
};

/**
 * 删除缓存（全局函数）/ Remove Cache (Global Function)
 * 全局快捷函数，无需注入 CacheService
 * Global shortcut function, no need to inject CacheService
 */
export const removeCache = async (key: any) => {
  const cacheService = Container.get(CacheService);
  await cacheService.removeCache(key);
};

/**
 * 获取缓存（全局函数）/ Get Cache (Global Function)
 * 全局快捷函数，无需注入 CacheService
 * Global shortcut function, no need to inject CacheService
 */
export const getCache = async <T = any>(key: any) => {
  const cacheService = Container.get(CacheService);
  return cacheService.getCache<T>(key);
};

/**
 * 批量获取缓存（全局函数）/ Get Caches (Global Function)
 * 全局快捷函数，无需注入 CacheService
 * Global shortcut function, no need to inject CacheService
 */
export const getCaches = async <T = any>(keys: any[]) => {
  const cacheService = Container.get(CacheService);
  return cacheService.getCaches<T>(keys);
};

/**
 * 重置缓存（全局函数）/ Reset Cache (Global Function)
 *
 * @param param 缓存参数 / Cache parameter
 *
 * 功能说明 / Description:
 * 全局快捷函数，无需注入 CacheService
 * Global shortcut function, no need to inject CacheService
 */
export function resetCache<P>(param: P) {
  const cacheService = Container.get(CacheService);
  cacheService.reset(param);
}

/**
 * 应用缓存到对象 / Apply Cache to Object
 *
 * @param target 目标对象或数组 / Target object or array
 * @param targetPath 目标对象路径配置 / Target object path configuration
 * @param cache 缓存数据数组 / Cache data array
 * @param cachePath 缓存对象路径配置 / Cache object path configuration
 * @param clone 是否克隆对象，默认 false / Whether to clone object, default false
 * @returns 处理后的对象 / Processed object
 *
 * 功能说明 / Description:
 * 将缓存数据应用到目标对象，替换指定字段的值
 * Applies cache data to target object, replacing specified field values
 *
 * 使用场景 / Use Cases:
 * - 用缓存的用户名替换用户 ID / Replace user ID with cached username
 * - 用缓存的分类名替换分类 ID / Replace category ID with cached category name
 * - 批量数据的字段填充 / Field filling for batch data
 *
 * 示例 / Example:
 * ```typescript
 * const posts = [
 *   { id: 1, authorId: 'u1', title: 'Post 1' },
 *   { id: 2, authorId: 'u2', title: 'Post 2' },
 * ];
 * const userCache = [
 *   { id: 'u1', name: 'Alice' },
 *   { id: 'u2', name: 'Bob' },
 * ];
 *
 * const result = applyCache(
 *   posts,
 *   { id: 'authorId', value: 'authorName' }, // 目标：从 authorId 匹配，写入 authorName
 *   userCache,
 *   { id: 'id', value: 'name' }, // 缓存：从 id 匹配，取 name 值
 * );
 * // result: [
 * //   { id: 1, authorId: 'u1', title: 'Post 1', authorName: 'Alice' },
 * //   { id: 2, authorId: 'u2', title: 'Post 2', authorName: 'Bob' },
 * // ]
 * ```
 */
export function applyCache<T, C>(target: T, targetPath: ReplaceObjectPath, cache: C[], cachePath: ReplaceObjectPathFull, clone = false) {
  const targetData = clone ? _.cloneDeep(target) : target;
  if (Array.isArray(targetData)) {
    // 数组情况：对每个元素应用缓存 / Array case: apply cache to each element
    targetData.forEach((t) => replaceObj(t, targetPath, cache, cachePath));
  } else {
    // 单个对象情况 / Single object case
    replaceObj(targetData, targetPath, cache, cachePath);
  }
  return targetData;
}

/**
 * 替换对象字段 / Replace Object Field
 * applyCache 的内部辅助函数
 * Internal helper function for applyCache
 */
function replaceObj(target: any, targetPath: ReplaceObjectPath, cache: any[], cachePath: ReplaceObjectPathFull) {
  // 从缓存中找到匹配的数据 / Find matching data from cache
  const data = cache.find((c) => _.isEqual(c[cachePath.id ?? 'id'], target[targetPath.id ?? 'id']));
  const value = data[cachePath.value];
  // 将缓存值写入目标对象 / Write cache value to target object
  target[targetPath.value ?? cachePath.value] = value;
}

/**
 * TTL 秒数函数类型 / TTL Seconds Function Type
 * 支持动态计算 TTL 值
 * Supports dynamic TTL calculation
 */
export type TTLSecondFn = (get: <T>(claz: ClassType<T>) => T) => number | Promise<number>;

/**
 * 缓存选项类型 / Cache Option Type
 * 用于 @L1Cache 和 @L2Cache 装饰器
 * For @L1Cache and @L2Cache decorators
 */
export type CacheOption = {
  /** 自定义缓存键，可选 / Custom cache key, optional */
  key?: any;
  /** TTL（秒），可以是数字或函数 / TTL in seconds, can be number or function */
  ttlSeconds?: number | TTLSecondFn;
};

/**
 * L1 缓存装饰器 / L1 Cache Decorator
 *
 * @param option 缓存选项 / Cache options
 * @returns 方法装饰器 / Method decorator
 *
 * 功能说明 / Description:
 * 为方法添加 L1 缓存，首次调用缓存结果，后续调用返回缓存
 * Adds L1 cache to method, caches result on first call, returns cache on subsequent calls
 *
 * 使用场景 / Use Cases:
 * - 高频访问的配置数据 / Frequently accessed config data
 * - 计算密集型方法 / Compute-intensive methods
 * - 短期有效的数据 / Short-term valid data
 *
 * 示例 / Example:
 * ```typescript
 * @Service()
 * class ConfigService {
 *   @L1Cache({ ttlSeconds: 60 })
 *   async getAppConfig() {
 *     return await this.configRepo.find();
 *   }
 *
 *   // 自定义缓存键 / Custom cache key
 *   @L1Cache({ key: 'user-settings', ttlSeconds: 300 })
 *   async getUserSettings(userId: string) {
 *     return await this.db.findSettings(userId);
 *   }
 * }
 * ```
 */
export function L1Cache(option?: CacheOption) {
  return cache(option ?? {}, true);
}

/**
 * L2 缓存装饰器 / L2 Cache Decorator
 *
 * @param option 缓存选项 / Cache options
 * @returns 方法装饰器 / Method decorator
 *
 * 功能说明 / Description:
 * 为方法添加 L2 (Redis) 缓存，跨进程共享缓存
 * Adds L2 (Redis) cache to method, shares cache across processes
 *
 * 使用场景 / Use Cases:
 * - 中频访问的用户数据 / Medium-frequency user data
 * - 需要跨进程共享的数据 / Data that needs cross-process sharing
 * - 较大的数据集 / Larger datasets
 *
 * 示例 / Example:
 * ```typescript
 * @Service()
 * class UserService {
 *   @L2Cache({ ttlSeconds: 600 })
 *   async getUserProfile(userId: string) {
 *     return await this.userRepo.findById(userId);
 *   }
 *
 *   // 动态 TTL / Dynamic TTL
 *   @L2Cache({
 *     ttlSeconds: (get) => {
 *       const config = get(ConfigService);
 *       return config.getCacheTTL();
 *     }
 *   })
 *   async getProducts() {
 *     return await this.productRepo.findAll();
 *   }
 * }
 * ```
 */
export function L2Cache(option?: CacheOption) {
  return cache(option ?? {}, false);
}

/**
 * 缓存装饰器工厂函数 / Cache Decorator Factory Function
 * L1Cache 和 L2Cache 的内部实现
 * Internal implementation for L1Cache and L2Cache
 */
function cache({ key, ttlSeconds }: CacheOption, isL1: boolean) {
  return function (target: any, propertyKey: any, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    // 替换原方法为带缓存的版本 / Replace original method with cached version
    descriptor.value = async function (...args: any[]) {
      // 构造缓存键：自定义键 或 类名.方法名 + 参数 / Construct cache key: custom key or ClassName.methodName + args
      const param = [key ?? `${target.constructor.name}.${propertyKey}`, ...args];
      const svc = Container.get(CacheService);
      // 根据 isL1 调用对应的缓存方法 / Call corresponding cache method based on isL1
      return isL1 ? svc.getL1(param, () => originalMethod.apply(this, args), await getTtlSeconds(ttlSeconds)) : svc.getL2(param, () => originalMethod.apply(this, args), await getTtlSeconds(ttlSeconds));
    };
  };
}

/**
 * 获取 TTL 秒数 / Get TTL Seconds
 * 处理 TTL 为数字或函数的情况
 * Handles TTL being number or function
 */
async function getTtlSeconds(val: number | TTLSecondFn | undefined) {
  if (typeof val === 'function') {
    // TTL 是函数，调用它获取动态值 / TTL is function, call it to get dynamic value
    return Promise.resolve(val((claz) => Container.get(claz)));
  } else {
    // TTL 是数字或 undefined / TTL is number or undefined
    return Promise.resolve(val);
  }
}
