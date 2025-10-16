/**
 * 定时器服务 / Timer Service
 *
 * 功能说明 / Description:
 * 基于 EventEmitter 的高性能定时器管理器，支持命名回调和动态间隔
 * High-performance timer manager based on EventEmitter with named callbacks and dynamic intervals
 *
 * 主要功能 / Main Features:
 * 1. 命名定时器 - 为每个定时任务分配唯一名称
 *    Named timers - Assign unique name to each timer task
 * 2. 多间隔支持 - 支持不同时间间隔的定时器
 *    Multiple intervals - Support timers with different time intervals
 * 3. 自动清理 - 无回调的定时器自动停止
 *    Auto cleanup - Timers with no callbacks are automatically stopped
 * 4. 异步回调 - 支持同步和异步回调函数
 *    Async callbacks - Support both sync and async callback functions
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { fmkTimer } from './libs/cache/Timer';
 *
 * // 注册 1 秒间隔的定时器 / Register 1-second interval timer
 * fmkTimer.onTimer('myTask', () => {
 *   console.log('Task executed every second');
 * }, 1);
 *
 * // 注册 5 秒间隔的定时器 / Register 5-second interval timer
 * fmkTimer.onTimer('heavyTask', async () => {
 *   await performHeavyOperation();
 * }, 5);
 *
 * // 取消指定定时器 / Cancel specific timer
 * fmkTimer.offTimer('myTask');
 *
 * // 停止所有定时器 / Stop all timers
 * fmkTimer.stop();
 * ```
 *
 * 应用场景 / Use Cases:
 * - 缓存过期检查 / Cache expiration checking
 * - 定期数据同步 / Periodic data synchronization
 * - 健康检查任务 / Health check tasks
 * - 日志刷新任务 / Log flush tasks
 */
import { EventEmitter } from 'eventemitter3';
import _ from 'lodash';

/**
 * 定时器事件常量 / Timer Event Constant
 * 定时器触发时发出的事件名称前缀
 * Event name prefix emitted when timer fires
 */
export const TIME_EVENT = 'FmkTimer.TimeIsUp';

/**
 * 回调函数映射类型 / Callback Function Map Type
 * 键为回调名称，值为回调函数
 * Key is callback name, value is callback function
 */
type Handlers = Record<string, () => any>;

/**
 * 微框架定时器类 / Microframework Timer Class
 *
 * 架构说明 / Architecture:
 * 使用元组结构 [NodeJS.Timeout, Handlers] 管理每个时间间隔
 * Uses tuple structure [NodeJS.Timeout, Handlers] to manage each time interval
 * - 元组索引 0: setInterval 返回的定时器句柄
 *   Tuple index 0: Timer handle returned by setInterval
 * - 元组索引 1: 命名回调函数映射对象
 *   Tuple index 1: Named callback function map object
 *
 * 优化策略 / Optimization Strategy:
 * 相同间隔的多个回调共享同一个 setInterval 实例
 * Multiple callbacks with same interval share single setInterval instance
 */
export class FmkTimer extends EventEmitter {
  /**
   * 定时器存储 / Timer Storage
   * 键为毫秒数，值为元组 [定时器句柄, 回调映射]
   * Key is milliseconds, value is tuple [timer handle, callback map]
   */
  timer: Record<string, [NodeJS.Timeout, Handlers]> = {};

  /**
   * 启动指定间隔的定时器 / Start Timer with Specified Interval
   *
   * @param interval 间隔时间（秒），默认 1 秒 / Interval time (seconds), default 1 second
   * @private
   *
   * 功能说明 / Description:
   * 创建底层 setInterval，并发出事件供回调订阅
   * Creates underlying setInterval and emits events for callback subscription
   *
   * 注意事项 / Notes:
   * - 相同间隔只会创建一个 setInterval 实例
   *   Only one setInterval instance is created for same interval
   * - 自动初始化空的回调映射对象
   *   Automatically initializes empty callback map object
   */
  private start(interval = 1) {
    const time = interval * 1000;
    if (!this.timer[time]) {
      this.timer[time] = [
        setInterval(() => {
          // 发出定时器事件 / Emit timer event
          this.emit(`${TIME_EVENT}#${interval}s`);
        }, time),
        {}, // 初始化空的回调映射 / Initialize empty callback map
      ];
    }
  }

  /**
   * 停止所有定时器 / Stop All Timers
   *
   * 功能说明 / Description:
   * 清除所有正在运行的 setInterval 实例
   * Clears all running setInterval instances
   *
   * 使用场景 / Use Cases:
   * - 应用关闭时调用 / Called on application shutdown
   * - 测试清理时调用 / Called during test cleanup
   */
  stop() {
    Object.values(this.timer)
      .map((v) => v[0]) // 提取定时器句柄 / Extract timer handles
      .forEach((timeout) => clearInterval(timeout)); // 清除所有定时器 / Clear all timers
  }

  /**
   * 取消指定名称的定时器回调 / Cancel Timer Callback by Name
   *
   * @param name 回调名称 / Callback name
   *
   * 功能说明 / Description:
   * 从所有时间间隔中移除指定名称的回调，并自动清理空定时器
   * Removes callback with specified name from all intervals and auto-cleans empty timers
   *
   * 清理逻辑 / Cleanup Logic:
   * 1. 从所有时间间隔中删除指定回调 / Remove specified callback from all intervals
   * 2. 检查每个时间间隔是否还有回调 / Check if each interval still has callbacks
   * 3. 清除没有回调的定时器实例 / Clear timer instances with no callbacks
   *
   * 示例 / Example:
   * ```typescript
   * fmkTimer.onTimer('task1', () => {}, 1);
   * fmkTimer.onTimer('task2', () => {}, 1);
   * fmkTimer.offTimer('task1'); // 只取消 task1，task2 继续运行
   * ```
   */
  offTimer(name: string) {
    // 1. 从所有时间间隔中删除指定回调 / Remove callback from all intervals
    Object.values(this.timer)
      .map((v) => v[1]) // 提取回调映射对象 / Extract callback map objects
      .filter((handler) => {
        return !_.isNil(handler[name]); // 找到包含该回调的映射 / Find maps containing the callback
      })
      .forEach((handler) => {
        delete handler[name]; // 删除回调 / Delete callback
      });

    // 2. 清理空的定时器 / Cleanup empty timers
    Object.keys(this.timer)
      .filter((key: any) => {
        // 找到没有回调的定时器 / Find timers with no callbacks
        return Object.keys(this.timer[key][1]).length === 0;
      })
      .forEach((key: any) => {
        clearInterval(this.timer[key][0]); // 清除定时器 / Clear timer
        delete this.timer[key]; // 删除记录 / Delete record
      });
  }

  /**
   * 注册定时器回调 / Register Timer Callback
   *
   * @param name 回调名称（唯一标识）/ Callback name (unique identifier)
   * @param callback 回调函数（支持同步和异步）/ Callback function (sync/async supported)
   * @param interval 间隔时间（秒），默认 1 秒 / Interval time (seconds), default 1 second
   *
   * 功能说明 / Description:
   * 注册一个命名回调，按指定间隔定期执行
   * Registers a named callback to execute periodically at specified interval
   *
   * 重要特性 / Important Features:
   * - 相同名称会覆盖之前的回调 / Same name overwrites previous callback
   * - 相同间隔的回调共享 setInterval 实例 / Callbacks with same interval share setInterval
   * - 支持异步回调（自动 Promise 包装）/ Supports async callbacks (auto Promise wrapping)
   *
   * 示例 / Example:
   * ```typescript
   * // 每秒执行一次 / Execute every second
   * fmkTimer.onTimer('cache-check', () => {
   *   checkCacheExpiration();
   * }, 1);
   *
   * // 每 10 秒执行一次异步任务 / Execute async task every 10 seconds
   * fmkTimer.onTimer('sync-data', async () => {
   *   await syncDataToDatabase();
   * }, 10);
   * ```
   */
  onTimer(name: string, callback: () => any, interval = 1) {
    const time = interval * 1000;
    if (!this.timer[time]) {
      // 首次使用该间隔，创建定时器 / First use of this interval, create timer
      this.start(interval);
      // 订阅定时器事件，执行所有回调 / Subscribe to timer event, execute all callbacks
      this.on(`${TIME_EVENT}#${interval}s`, () => {
        // 并行执行所有回调（支持异步）/ Execute all callbacks in parallel (async supported)
        Promise.all(Object.values(this.timer[time][1]).map((cb) => Promise.resolve(cb())));
      });
    }
    // 注册/更新回调 / Register/update callback
    this.timer[time][1][name] = callback;
  }
}

/**
 * 全局定时器实例 / Global Timer Instance
 *
 * 使用说明 / Usage:
 * 导出单例实例，全局共享使用
 * Exported singleton instance for global shared usage
 *
 * 示例 / Example:
 * ```typescript
 * import { fmkTimer } from './libs/cache/Timer';
 * fmkTimer.onTimer('myTask', () => console.log('executed'), 1);
 * ```
 */
export const fmkTimer = new FmkTimer();
