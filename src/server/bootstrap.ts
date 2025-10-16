/**
 * 应用程序启动引导器 / Application Bootstrap
 *
 * 功能说明 / Description:
 * 使用微框架模式初始化和启动整个应用程序，按顺序加载各个模块
 * Initializes and starts the entire application using microframework pattern,
 * loading modules in sequence
 *
 * 加载顺序 / Loading Order:
 * 1. TypeORM - 数据库连接 / Database connection
 * 2. Redis - 缓存服务 / Cache service
 * 3. RabbitMQ - 分布式事件系统 / Distributed event system
 * 4. Koa - Web 服务器 (RESTful + WebSocket) / Web server
 * 5. API Gateway - 服务注册 (可选) / Service registration (optional)
 * 6. 自定义加载器 (可选) / Custom loaders (optional)
 *
 * 使用方法 / Usage:
 * ```typescript
 * import { bootstrap } from './src/server/bootstrap';
 *
 * bootstrap({
 *   restfulControllers: [UserController],
 *   wsControllers: [ChatController],
 *   entities: [User, Role],
 *   eventsHandlers: [UserEventHandler]
 * });
 * ```
 */

import { bootstrapMicroframework, Microframework, MicroframeworkSettings } from 'microframework';
import 'reflect-metadata';
import { apiGatewayLoader } from '../libs/gateway';
import { ApplicationConfig, ConfigManager } from '../libs/configure';
import { rabbitmqLoader } from '../libs/rabbitmq';
import { koaLoader } from '../libs/koa';
import { Logger } from '../libs/logger';
import { redisLoader } from '../libs/redis';
import { typeormLoader } from '../libs/orm';
import { BootstrapOption } from './BootstrapOption';
import { getLocalIpAddress } from '../libs/network';

// 空加载器，用于禁用某些模块时使用 / Empty loader for disabled modules
const emptyLoader = () => {};

// 存储微框架设置 / Store microframework settings
const settingHolder: { setting?: MicroframeworkSettings } = {};

/**
 * 启动应用程序 / Bootstrap application
 *
 * @param option 启动配置选项 / Bootstrap configuration options
 * @returns 微框架实例 / Microframework instance
 *
 * 配置选项说明 / Configuration Options:
 * - restfulControllers: RESTful API 控制器数组 / Array of RESTful controllers
 * - wsControllers: WebSocket 控制器数组 / Array of WebSocket controllers
 * - entities: TypeORM 实体类数组 / Array of TypeORM entities
 * - eventsHandlers: 事件处理器数组 / Array of event handlers
 * - disableDatabase: 禁用数据库连接 / Disable database connection
 * - disableRedis: 禁用 Redis 连接 / Disable Redis connection
 * - disableEvent: 禁用事件系统 / Disable event system
 * - loaders: 自定义加载器 / Custom loaders
 */
export const bootstrap = async (option: BootstrapOption): Promise<Microframework> => {
  const logger = Logger.getLogger('Bootstrap');

  // 构建加载器列表 / Build loader list
  const loaders = [
    // 1. 数据库加载器 (可选) / Database loader (optional)
    option.disableDatabase ? emptyLoader : typeormLoader(option),

    // 2. Redis 加载器 (可选) / Redis loader (optional)
    option.disableRedis ? emptyLoader : redisLoader(option),

    // 3. RabbitMQ 事件系统加载器 (可选) / RabbitMQ event system loader (optional)
    option.disableEvent ? emptyLoader : rabbitmqLoader(option),

    // 4. Koa Web 服务器加载器 (必需) / Koa web server loader (required)
    koaLoader(option),

    // 5. API 网关加载器 (可选，通过环境变量控制)
    // API Gateway loader (optional, controlled by env var)
    apiGatewayLoader(option),

    // 6. 保存微框架设置 / Save microframework settings
    (settings?: MicroframeworkSettings) => {
      settingHolder.setting = settings;
    },
  ];

  // 添加自定义加载器 / Add custom loaders
  if (option.loaders) {
    loaders.push(...option.loaders);
  }

  // 执行微框架启动 / Execute microframework bootstrap
  return bootstrapMicroframework({
    config: {
      // 开发环境显示启动时间 / Show bootstrap time in development
      showBootstrapTime: ConfigManager.isDevelopment(),
    },
    loaders,
  }).then(async (mfmk) => {
    // 保存框架设置到实例 / Save framework settings to instance
    (mfmk as any).frameworkSettings = settingHolder.setting;

    // 获取应用配置 / Get application configuration
    const cfg = ConfigManager.getConfig<ApplicationConfig>('application');
    const applicationName = cfg.appName;

    // 获取本机 IP 地址 / Get local IP address
    const networks = await getLocalIpAddress();

    // 生产环境使用应用名，开发环境使用 IP
    // Use app name in production, IP in development
    const host = ConfigManager.isProduction() ? applicationName : networks;

    // 构建基础路径 / Build base path
    ConfigManager.basePath = `http://${host}:${cfg.port}/api/v${cfg.version}/${applicationName}/`;

    // 输出 RESTful API 服务信息 / Output RESTful API service info
    logger.info(
      `🚀Server(${applicationName}/v${cfg.version}/${ConfigManager.getPkgVersion()}/${ConfigManager.getBuildNumber()}) is listening on ${ConfigManager.basePath}`
    );

    // 如果启用了 WebSocket，输出 WebSocket 服务信息
    // If WebSocket is enabled, output WebSocket service info
    if (option.wsControllers) {
      const wsPath = `http://${host}:${cfg.port}/api/v${cfg.version}/${applicationName}/socket.io`;
      logger.info(
        `🚀Server(${applicationName}/v${cfg.version}/${ConfigManager.getPkgVersion()}/${ConfigManager.getBuildNumber()}) is listening on ${wsPath}`
      );
    }

    return mfmk;
  });
};
