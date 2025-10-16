/**
 * 分布式领导者选举 / Distributed Leader Election
 *
 * 功能说明 / Description:
 * 基于 Redis 实现的分布式领导者选举机制，用于集群环境中确保某些任务只在一个实例上执行
 * Redis-based distributed leader election mechanism for ensuring certain tasks
 * run on only one instance in a cluster environment
 *
 * 使用场景 / Use Cases:
 * - 定时任务调度 (确保只有一个实例执行定时任务)
 *   Scheduled task execution (ensure only one instance runs scheduled tasks)
 * - 数据同步任务 / Data synchronization tasks
 * - 资源清理任务 / Resource cleanup tasks
 * - 分布式锁应用 / Distributed lock applications
 *
 * 使用方法 / Usage:
 * ```typescript
 * import { Container } from 'typedi';
 * import { Leader, LeaderEvents } from './Leader';
 *
 * const leader = Container.get(Leader);
 *
 * // 配置并开始选举 / Configure and start election
 * leader
 *   .config({
 *     project: 'MyScheduledTask',  // 项目标识 / Project identifier
 *     ttl: 10000,                   // 锁的 TTL (毫秒) / Lock TTL in milliseconds
 *     wait: 1000                    // 重试等待时间 / Retry wait time
 *   })
 *   .elect();
 *
 * // 监听选举事件 / Listen to election events
 * leader.on(LeaderEvents.elected, () => {
 *   console.log('This instance is now the leader');
 *   // 执行只需要领导者执行的任务 / Execute leader-only tasks
 * });
 *
 * leader.on(LeaderEvents.revoked, () => {
 *   console.log('Leadership was revoked');
 *   // 停止领导者任务 / Stop leader tasks
 * });
 *
 * // 检查当前实例是否为领导者 / Check if current instance is leader
 * const isLeader = await leader.isLeader();
 *
 * // 主动放弃领导权 / Voluntarily give up leadership
 * await leader.stop();
 * ```
 *
 * 工作原理 / How It Works:
 * 1. 每个实例尝试在 Redis 中设置一个带 TTL 的键值对
 *    Each instance tries to set a key-value pair with TTL in Redis
 * 2. 成功设置的实例成为领导者，定期续约
 *    The instance that successfully sets it becomes the leader and renews periodically
 * 3. 如果领导者宕机，键会过期，其他实例可以竞选
 *    If leader crashes, the key expires and other instances can compete
 * 4. 领导者每隔 TTL/2 时间续约一次
 *    Leader renews every TTL/2 interval
 */

import crypto from 'crypto';
import EventEmitter from 'eventemitter3';
import Redis from 'ioredis';
import { Service } from 'typedi';
import { ApplicationConfig, ConfigManager } from '../configure';
import { id as generateId } from '../generator';
import { Logger } from '../logger';
import { RedisClient } from '../redis';
import { LeaderOptions } from './LeaderOptions';

/**
 * 生成哈希键，避免键冲突 / Generate hashed key to avoid collisions
 * @param key 项目键 / Project key
 * @returns SHA1 哈希值 / SHA1 hash value
 */
const hashKey = function (key: string) {
  const { appName } = ConfigManager.getConfig<ApplicationConfig>('application');
  const keyStr = `LeaderLock.${appName}.${key}`;
  return crypto.createHash('sha1').update(keyStr).digest('hex');
};

/**
 * 领导者选举配置类 / Leader Election Configuration Class
 * 封装选举相关的配置参数 / Encapsulates election-related configuration parameters
 */
class LeaderOption {
  /**
   * 锁的生存时间 (毫秒) / Lock time-to-live in milliseconds
   * 如果领导者在此时间内未续约，锁会自动释放
   * If leader doesn't renew within this time, lock is automatically released
   */
  ttl = 10000;

  /**
   * 选举失败后的等待时间 (毫秒) / Wait time after election failure in milliseconds
   * 失败后等待此时间再次尝试选举 / Wait this time before retrying election
   */
  wait = 1000;

  /**
   * 项目标识键 / Project identifier key
   * 用于区分不同的选举项目 / Used to distinguish different election projects
   */
  _key = 'default';

  constructor(private leader: Leader) {}

  /**
   * 获取项目键 / Get project key
   */
  get project() {
    return this._key;
  }

  /**
   * 设置项目键 / Set project key
   * 同时更新 Leader 实例的哈希键 / Also updates Leader instance's hashed key
   */
  set project(key: string) {
    this._key = key;
    this.leader.key = hashKey(key);
  }
}

/**
 * 领导者选举事件常量 / Leader Election Event Constants
 * 用于监听选举状态变化 / Used to listen to election state changes
 */
export const LeaderEvents = {
  /** 当前实例被选举为领导者 / Current instance elected as leader */
  elected: 'elected',

  /** 当前实例的领导权被撤销 / Current instance's leadership revoked */
  revoked: 'revoked',

  /** 选举过程中发生错误 / Error occurred during election */
  error: 'error',
};

/**
 * 领导者选举服务类 / Leader Election Service Class
 * 继承 EventEmitter，支持事件监听 / Extends EventEmitter for event listening
 */
@Service()
export class Leader extends EventEmitter {
  /** 日志记录器 / Logger */
  logger = Logger.getLogger(Leader);

  /**
   * 当前实例的唯一标识符 (16 字符随机 ID)
   * Unique identifier for current instance (16-char random ID)
   */
  readonly id = generateId(16);

  /**
   * Redis 客户端实例 / Redis client instance
   */
  readonly redis: Redis;

  /**
   * Redis 中的锁键 (哈希后的项目键)
   * Lock key in Redis (hashed project key)
   */
  key: string;

  /**
   * 选举配置选项 / Election configuration options
   */
  options = new LeaderOption(this);

  /**
   * 续约定时器 ID / Renewal timer ID
   * 领导者定期续约锁的定时器 / Timer for leader to periodically renew lock
   */
  private renewId: NodeJS.Timeout;

  /**
   * 选举定时器 ID / Election timer ID
   * 非领导者重试选举的定时器 / Timer for non-leaders to retry election
   */
  private electId: NodeJS.Timeout;

  /**
   * 构造函数 / Constructor
   * @param redisClient Redis 客户端服务 / Redis client service
   */
  constructor(redisClient: RedisClient) {
    super();
    // 创建独立的 Redis 连接 / Create independent Redis connection
    this.redis = redisClient.newClient();

    // 监听选举成功事件 / Listen to election success event
    this.on(LeaderEvents.elected, () => {
      this.logger.info(`🚀Current service is elected as ${this.options.project}'s leader now.`);
    });

    // 监听错误事件 / Listen to error event
    this.on(LeaderEvents.error, (e) => {
      this.logger.error(e);
    });
  }

  /**
   * 配置选举参数 / Configure election parameters
   * @param options 选举配置选项 / Election configuration options
   * @returns Leader 实例 (支持链式调用) / Leader instance (supports chaining)
   *
   * 示例 / Example:
   * ```typescript
   * leader.config({ project: 'MyTask', ttl: 10000, wait: 1000 }).elect();
   * ```
   */
  config(options: LeaderOptions) {
    Object.assign(this.options, options);
    return this;
  }

  /**
   * 检查当前实例是否为领导者 / Check if current instance is leader
   * @returns true 如果是领导者 / true if is leader
   *
   * 实现原理 / Implementation:
   * 从 Redis 中获取锁的值，与当前实例 ID 比较
   * Gets lock value from Redis and compares with current instance ID
   */
  async isLeader() {
    try {
      const id = await this.redis.get(this.key);
      return id === this.id;
    } catch (error) {
      this.emit(LeaderEvents.error, error);
      return false;
    }
  }

  /**
   * 续约领导权 / Renew leadership
   *
   * 工作流程 / Workflow:
   * 1. 检查当前实例是否仍为领导者 / Check if current instance is still leader
   * 2. 如果是，则延长锁的 TTL / If yes, extend lock TTL
   * 3. 如果不是，则停止续约并重新选举 / If no, stop renewal and re-elect
   *
   * 注意 / Note:
   * 此方法由定时器定期调用，频率为 TTL/2
   * This method is called periodically by timer at TTL/2 frequency
   */
  async renew() {
    try {
      // 安全检查：确认仍然是领导者 / Safety check: confirm still leader
      const isLeader = await this.isLeader();
      if (isLeader) {
        // 延长锁的过期时间 / Extend lock expiration
        await this.redis.pexpire(this.key, this.options.ttl);
      } else {
        // 领导权丢失，停止续约 / Leadership lost, stop renewal
        clearInterval(this.renewId);
        // 重新开始选举 / Restart election
        this.electId = setTimeout(() => this.elect(), this.options.wait);
        this.emit(LeaderEvents.revoked);
      }
    } catch (error) {
      this.emit(LeaderEvents.error, error);
    }
  }

  /**
   * 发起领导者选举 / Initiate leader election
   *
   * 工作流程 / Workflow:
   * 1. 尝试在 Redis 中设置锁 (原子操作 SET NX PX)
   *    Try to set lock in Redis (atomic operation SET NX PX)
   * 2. 如果成功，成为领导者并开始定期续约
   *    If successful, become leader and start periodic renewal
   * 3. 如果失败，等待一段时间后重试
   *    If failed, wait and retry
   *
   * Redis 命令说明 / Redis Command Explanation:
   * - NX: 仅当键不存在时设置 / Set only if key doesn't exist
   * - PX: 设置毫秒级过期时间 / Set expiration in milliseconds
   */
  async elect() {
    try {
      // 原子操作：尝试获取锁 / Atomic operation: try to acquire lock
      const res = await this.redis.set(this.key, this.id, 'PX', this.options.ttl, 'NX');

      if (res !== null) {
        // 选举成功，触发事件 / Election successful, emit event
        this.emit(LeaderEvents.elected);
        // 启动续约定时器 (每 TTL/2 执行一次)
        // Start renewal timer (executes every TTL/2)
        this.renewId = setInterval(() => this.renew(), this.options.ttl / 2);
      } else {
        // 选举失败，等待后重试 / Election failed, wait and retry
        // 使用 setTimeout 避免栈溢出 / Use setTimeout to avoid stack overflow
        this.electId = setTimeout(() => this.elect(), this.options.wait);
      }
    } catch (error) {
      this.emit(LeaderEvents.error, error);
    }
  }

  /**
   * 停止选举并放弃领导权 / Stop election and give up leadership
   *
   * 使用场景 / Use Cases:
   * - 应用关闭时主动释放锁 / Voluntarily release lock when app shuts down
   * - 需要暂停领导者任务时 / When need to pause leader tasks
   *
   * 注意 / Note:
   * 存在竞态条件：get -> compare -> delete 不是原子操作
   * Race condition exists: get -> compare -> delete is not atomic
   * 建议使用 Lua 脚本实现原子删除 / Recommend using Lua script for atomic delete
   */
  async stop() {
    try {
      const isLeader = await this.isLeader();
      if (isLeader) {
        // 删除锁 / Delete lock
        // 可能存在竞态条件 / Possible race condition
        await this.redis.del(this.key);
        this.emit(LeaderEvents.revoked);
      }
      // 清理定时器 / Clear timers
      clearInterval(this.renewId);
      clearTimeout(this.electId);
    } catch (error) {
      this.emit(LeaderEvents.error, error);
    }
  }
}
