/**
 * Redis 加载器 / Redis Loader
 *
 * 功能说明 / Description:
 * 微框架加载器，用于初始化 Redis 连接和客户端注册
 * Microframework loader for initializing Redis connection and client registration
 *
 * 主要功能 / Main Features:
 * 1. Redis 连接初始化 - 建立到 Redis 服务器的连接
 *    Redis connection initialization - Establish connection to Redis server
 * 2. 客户端注册 - 将 RedisClient 注册到 TypeDI 容器
 *    Client registration - Register RedisClient to TypeDI container
 * 3. 连接监控 - 监听连接事件并记录日志
 *    Connection monitoring - Listen to connection events and log
 * 4. 优雅关闭 - 应用关闭时断开 Redis 连接
 *    Graceful shutdown - Disconnect Redis on app shutdown
 *
 * 配置文件 / Configuration File:
 * cfg/redis.yml
 * ```yaml
 * redis: redis://localhost:6379
 * # 或使用对象格式 / Or use object format
 * redis:
 *   host: localhost
 *   port: 6379
 *   password: mypassword
 *   db: 0
 * ```
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { bootstrap } from './server/bootstrap';
 *
 * bootstrap({
 *   // Redis 会自动加载，无需额外配置
 *   // Redis will be loaded automatically, no extra config needed
 *   // 除非需要禁用: disableRedis: true
 *   // Unless you need to disable it: disableRedis: true
 * });
 * ```
 */
import { MicroframeworkSettings } from 'microframework';
import { Container } from 'typedi';
import { DatabaseConfig, ConfigManager, RedisConfig } from '../configure';
import { Logger } from '../logger';
import { RedisClient } from './RedisClient';

/**
 * Redis 加载器选项 / Redis Loader Options
 * 当前未使用，保留用于未来扩展
 * Currently unused, reserved for future extensions
 */
export type RedisLoaderOption = unknown;

/**
 * Redis 加载器函数 / Redis Loader Function
 *
 * @param option Redis 加载选项 / Redis loader options
 * @returns 微框架加载器函数 / Microframework loader function
 *
 * 功能说明 / Description:
 * 创建并返回一个微框架加载器，用于初始化 Redis 连接
 * Creates and returns a microframework loader for initializing Redis connection
 *
 * 加载流程 / Loading Process:
 * 1. 读取 Redis 配置 / Read Redis configuration
 * 2. 创建 RedisClient 实例 / Create RedisClient instance
 * 3. 注册到 TypeDI 容器 / Register to TypeDI container
 * 4. 注册关闭钩子 / Register shutdown hook
 * 5. 等待连接成功 / Wait for connection success
 *
 * 连接状态 / Connection States:
 * - connect: 连接成功 / Connection successful
 * - ready: 准备就绪（可以执行命令）/ Ready (can execute commands)
 * - error: 连接错误 / Connection error
 * - close: 连接关闭 / Connection closed
 */
export const redisLoader = (option: RedisLoaderOption) => (settings?: MicroframeworkSettings) => {
  // 1. 加载 Redis 配置 / Load Redis configuration
  const cfg = ConfigManager.getConfig<RedisConfig>('redis');

  // 2. 创建 RedisClient 实例 / Create RedisClient instance
  const redisClient: RedisClient = new RedisClient(cfg.redis);

  // 3. 注册到 TypeDI 容器 / Register to TypeDI container
  // 之后可以通过 Container.get(RedisClient) 获取
  // Later can be retrieved via Container.get(RedisClient)
  Container.set(RedisClient, redisClient);

  // 4. 获取底层 Redis 实例 / Get underlying Redis instance
  const { redis } = redisClient;

  // 5. 注册关闭钩子，应用关闭时断开连接
  //    Register shutdown hook to disconnect on app shutdown
  settings?.onShutdown(async () => redis.disconnect());

  // 6. 记录连接日志 / Log connection info
  Logger.getLogger('RedisLoader').info(`🔗Redis connected. redisCfg: ${cfg.redis} `);

  // 7. 返回 Promise，等待连接成功后 resolve
  //    Return Promise that resolves when connection is successful
  return new Promise<void>((resolve) => {
    redis.once('connect', () => {
      resolve();
    });
  });
};
