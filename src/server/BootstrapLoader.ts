/**
 * 启动加载器类型定义 / Bootstrap Loader Type Definition
 *
 * 功能说明 / Description:
 * 定义微框架加载器的函数签名，用于在应用启动时执行模块初始化
 * Defines the function signature for microframework loaders that initialize modules during application startup
 *
 * 使用场景 / Use Cases:
 * - 数据库连接初始化 / Database connection initialization
 * - Redis 客户端初始化 / Redis client initialization
 * - RabbitMQ 连接初始化 / RabbitMQ connection initialization
 * - Koa 服务器启动 / Koa server startup
 * - 自定义模块加载 / Custom module loading
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * const myLoader: BootstrapLoader = async (settings) => {
 *   // 初始化你的模块 / Initialize your module
 *   const service = await initializeService();
 *
 *   // 可选：将服务注册到设置中 / Optional: Register service in settings
 *   if (settings) {
 *     settings.setData('myService', service);
 *   }
 * };
 * ```
 */
import { MicroframeworkSettings } from 'microframework';

/**
 * 启动加载器函数类型 / Bootstrap Loader Function Type
 *
 * @param settings 微框架设置对象，用于在加载器之间共享数据
 *                 Microframework settings object for sharing data between loaders
 * @returns Promise 返回任意类型的异步结果
 *          Promise that returns async result of any type
 */
export type BootstrapLoader = (settings?: MicroframeworkSettings) => Promise<any>;
