/**
 * 应用启动配置选项 / Application Bootstrap Configuration Options
 *
 * 功能说明 / Description:
 * 定义应用启动时的完整配置选项，组合了所有模块的配置参数
 * Defines complete configuration options for application startup, combining all module configurations
 *
 * 配置组成 / Configuration Components:
 * 1. KoaLoaderOption - Koa Web 服务器配置 (RESTful + WebSocket)
 * 2. TypeormLoaderOption - TypeORM 数据库配置
 * 3. RedisLoaderOption - Redis 缓存配置
 * 4. DistributedEventsLoaderOption - RabbitMQ 分布式事件配置
 * 5. 模块开关选项 - Module toggle options
 * 6. 自定义加载器 - Custom loaders
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * const option: BootstrapOption = {
 *   // RESTful 控制器 / RESTful controllers
 *   restfulControllers: [UserController, ProductController],
 *
 *   // WebSocket 控制器 / WebSocket controllers
 *   wsControllers: [ChatController],
 *
 *   // 数据库实体 / Database entities
 *   entities: [User, Product, Order],
 *
 *   // 事件处理器 / Event handlers
 *   eventsHandlers: [UserEventHandler],
 *
 *   // 禁用某些模块 / Disable certain modules
 *   disableRedis: false,
 *   disableDatabase: false,
 *   disableEvent: false,
 *
 *   // 自定义加载器 / Custom loaders
 *   loaders: [myCustomLoader]
 * };
 * ```
 */
import { DistributedEventsLoaderOption, KoaLoaderOption, RedisLoaderOption, TypeormLoaderOption } from '../libs';
import { BootstrapLoader } from './BootstrapLoader';

/**
 * 启动配置选项类型 / Bootstrap Configuration Options Type
 *
 * 继承的配置 / Inherited Configurations:
 * - KoaLoaderOption: Web 服务器配置 (控制器、中间件等)
 * - TypeormLoaderOption: 数据库配置 (实体、连接选项等)
 * - RedisLoaderOption: Redis 配置 (连接信息等)
 * - DistributedEventsLoaderOption: 事件系统配置 (事件处理器等)
 *
 * 扩展选项 / Extended Options:
 * @property disableRedis 是否禁用 Redis 连接，默认 false
 *                        Whether to disable Redis connection, default false
 * @property disableDatabase 是否禁用数据库连接，默认 false
 *                           Whether to disable database connection, default false
 * @property disableEvent 是否禁用事件系统，默认 false
 *                        Whether to disable event system, default false
 * @property loaders 自定义加载器数组，用于扩展启动流程
 *                   Array of custom loaders to extend bootstrap process
 */
export type BootstrapOption = KoaLoaderOption &
  TypeormLoaderOption &
  RedisLoaderOption &
  DistributedEventsLoaderOption & {
    /** 禁用 Redis 模块 / Disable Redis module */
    disableRedis?: boolean;
    /** 禁用数据库模块 / Disable database module */
    disableDatabase?: boolean;
    /** 禁用事件系统模块 / Disable event system module */
    disableEvent?: boolean;
    /** 自定义加载器列表 / Custom loader list */
    loaders?: BootstrapLoader[];
  };
