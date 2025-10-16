/**
 * Redis 客户端封装 / Redis Client Wrapper
 *
 * 功能说明 / Description:
 * 对 ioredis 进行封装，提供 Redis 操作的高级接口
 * Wraps ioredis to provide high-level Redis operation interfaces
 *
 * 主要功能 / Main Features:
 * 1. 基础 Redis 操作 - 通过 redis 属性访问
 *    Basic Redis operations - Access via redis property
 * 2. 计数器管理 - Hash 结构的计数器操作
 *    Counter management - Counter operations using Hash structure
 * 3. 批量操作 - 使用 pipeline 提高性能
 *    Batch operations - Use pipeline for better performance
 * 4. 客户端创建 - 支持创建新的 Redis 连接
 *    Client creation - Support creating new Redis connections
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { RedisClient } from './libs/redis';
 * import { Container } from 'typedi';
 *
 * // 获取 Redis 客户端 / Get Redis client
 * const redisClient = Container.get(RedisClient);
 *
 * // 基础操作 / Basic operations
 * await redisClient.redis.set('key', 'value');
 * const value = await redisClient.redis.get('key');
 *
 * // 计数器操作 / Counter operations
 * await redisClient.saveCounter('stats', { views: 0, likes: 0 });
 * await redisClient.increaseCounter('stats', 'views', 1);
 * const views = await redisClient.getCounterValues('stats', 'views');
 * ```
 *
 * 计数器使用场景 / Counter Use Cases:
 * - 页面访问统计 / Page view statistics
 * - 用户点赞计数 / User like counting
 * - API 调用次数统计 / API call statistics
 * - 库存数量管理 / Inventory quantity management
 */
import Redis from 'ioredis';
import _ from 'lodash';
import { Logger } from '../logger';

/**
 * Redis 客户端类 / Redis Client Class
 */
export class RedisClient {
  /** 日志记录器 / Logger instance */
  private logger = Logger.getLogger(RedisClient);

  /**
   * Redis 实例 / Redis instance
   * 可直接使用此属性进行 Redis 操作
   * Can directly use this property for Redis operations
   */
  public readonly redis: Redis;

  /**
   * 构造函数 / Constructor
   *
   * @param redisCfg Redis 配置 / Redis configuration
   *                 支持字符串 URL 或配置对象
   *                 Supports string URL or config object
   *
   * 配置示例 / Configuration Examples:
   * - 字符串: "redis://localhost:6379"
   * - 对象: { host: 'localhost', port: 6379, password: '...' }
   */
  constructor(public readonly redisCfg: string | any) {
    this.redis = this.newClient();
  }

  /**
   * 创建新的 Redis 客户端 / Create New Redis Client
   *
   * @returns Redis 客户端实例 / Redis client instance
   *
   * 功能说明 / Description:
   * 创建新的 Redis 连接，用于需要独立连接的场景
   * Creates new Redis connection for scenarios requiring independent connections
   *
   * 使用场景 / Use Cases:
   * - 发布/订阅模式需要独立连接 / Pub/Sub requires separate connection
   * - 阻塞操作需要独立连接 / Blocking operations need separate connection
   *
   * 示例 / Example:
   * ```typescript
   * const subscriber = redisClient.newClient();
   * subscriber.subscribe('channel');
   * ```
   */
  newClient() {
    return new Redis(this.redisCfg);
  }

  /**
   * 保存计数器 / Save Counter
   *
   * @param counterName 计数器名称（Hash key）/ Counter name (Hash key)
   * @param counter 计数器字段和值的映射 / Map of counter fields and values
   * @param overwrite 是否覆盖已存在的值，默认 false / Whether to overwrite existing values, default false
   *
   * 功能说明 / Description:
   * 将计数器数据保存到 Redis Hash 结构中
   * Saves counter data to Redis Hash structure
   *
   * 保存模式 / Save Modes:
   * - overwrite=false: 只设置不存在的字段（使用 HSETNX）
   *   Only set non-existing fields (use HSETNX)
   * - overwrite=true: 覆盖所有字段（使用 HSET）
   *   Overwrite all fields (use HSET)
   *
   * 示例 / Example:
   * ```typescript
   * // 初始化计数器 / Initialize counters
   * await redisClient.saveCounter('article:123', {
   *   views: 0,
   *   likes: 0,
   *   shares: 0
   * });
   *
   * // 覆盖更新 / Overwrite update
   * await redisClient.saveCounter('article:123', {
   *   views: 100
   * }, true);
   * ```
   */
  async saveCounter(counterName: string, counter: Record<string, number>, overwrite = false) {
    if (overwrite) {
      // 覆盖模式：直接设置所有字段 / Overwrite mode: set all fields directly
      await this.redis.hset(counterName, counter);
    } else {
      // 非覆盖模式：使用 pipeline 批量执行 HSETNX
      // Non-overwrite mode: batch execute HSETNX using pipeline
      const pl = this.redis.multi();
      Object.keys(counter).forEach((field) => {
        const value = counter[field];
        if (!_.isNil(value)) {
          pl.hsetnx(counterName, field, value);
        }
      });
      await pl.exec();
    }
  }

  /**
   * 增加计数器 / Increase Counter
   *
   * @param counterName 计数器名称 / Counter name
   * @param name 字段名 / Field name
   * @param step 增加步长，默认 1 / Increment step, default 1
   * @returns 增加后的值 / Value after increment
   *
   * 功能说明 / Description:
   * 原子性地增加计数器的值
   * Atomically increment counter value
   *
   * 示例 / Example:
   * ```typescript
   * // 页面访问量 +1 / Page views +1
   * const newViews = await redisClient.increaseCounter('article:123', 'views');
   *
   * // 库存减少 -5（使用负步长）/ Decrease inventory by 5 (use negative step)
   * await redisClient.increaseCounter('product:456', 'stock', -5);
   * ```
   */
  async increaseCounter(counterName: string, name: string, step = 1) {
    return this.redis.hincrby(counterName, name, step);
  }

  /**
   * 减少计数器 / Decrease Counter
   *
   * @param counterName 计数器名称 / Counter name
   * @param name 字段名 / Field name
   * @param step 减少步长，默认 1 / Decrement step, default 1
   * @returns 减少后的值 / Value after decrement
   *
   * 功能说明 / Description:
   * 原子性地减少计数器的值
   * Atomically decrement counter value
   *
   * 示例 / Example:
   * ```typescript
   * // 取消点赞 / Unlike
   * const newLikes = await redisClient.decreaseCounter('article:123', 'likes');
   * ```
   */
  async decreaseCounter(counterName: string, name: string, step = 1) {
    return this.redis.hincrby(counterName, name, 0 - step);
  }

  /**
   * 删除计数器字段 / Remove Counter Field
   *
   * @param counterName 计数器名称 / Counter name
   * @param name 字段名或字段名数组 / Field name or array of field names
   * @returns 删除的字段数量 / Number of fields removed
   *
   * 功能说明 / Description:
   * 从计数器中删除一个或多个字段
   * Remove one or more fields from counter
   *
   * 示例 / Example:
   * ```typescript
   * // 删除单个字段 / Remove single field
   * await redisClient.removeCounter('stats', 'deprecated_field');
   *
   * // 删除多个字段 / Remove multiple fields
   * await redisClient.removeCounter('stats', ['field1', 'field2']);
   * ```
   */
  async removeCounter(counterName: string, name: string | string[]) {
    if (typeof name === 'string') {
      // 删除单个字段 / Remove single field
      return this.redis.hdel(counterName, name);
    } else {
      // 批量删除多个字段 / Batch remove multiple fields
      const pl = this.redis.multi();
      name.forEach((n) => pl.hdel(counterName, n));
      return pl.exec();
    }
  }

  /**
   * 获取计数器所有字段名 / Get All Counter Field Names
   *
   * @param counterName 计数器名称 / Counter name
   * @returns 字段名数组 / Array of field names
   *
   * 示例 / Example:
   * ```typescript
   * const fields = await redisClient.getCounterKeys('article:123');
   * // 返回 / Returns: ['views', 'likes', 'shares']
   * ```
   */
  async getCounterKeys(counterName: string) {
    return this.redis.hkeys(counterName);
  }

  /**
   * 获取计数器字段值 / Get Counter Field Values
   *
   * @param counterName 计数器名称 / Counter name
   * @param name 字段名或字段名数组 / Field name or array of field names
   * @returns 字段值或字段值数组 / Field value or array of field values
   *
   * 功能说明 / Description:
   * 获取一个或多个计数器字段的值
   * Get value of one or more counter fields
   *
   * 示例 / Example:
   * ```typescript
   * // 获取单个字段 / Get single field
   * const views = await redisClient.getCounterValues('article:123', 'views');
   *
   * // 获取多个字段 / Get multiple fields
   * const [views, likes] = await redisClient.getCounterValues('article:123', ['views', 'likes']);
   * ```
   */
  async getCounterValues(counterName: string, name: string | string[]) {
    if (typeof name === 'string') {
      // 获取单个字段值 / Get single field value
      return this.redis.hget(counterName, name);
    } else {
      // 批量获取多个字段值 / Batch get multiple field values
      return this.redis.hmget(counterName, ...name);
    }
  }
}
