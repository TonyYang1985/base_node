/**
 * 类型工具 / Type Utilities
 *
 * 功能说明 / Description:
 * 提供 TypeScript 类型工具，用于泛型编程和类型推导
 * Provides TypeScript type utilities for generic programming and type inference
 */

/**
 * 类构造函数类型 / Class Constructor Type
 *
 * 功能说明 / Description:
 * 表示一个可以被实例化的类的构造函数类型
 * Represents a constructor type of an instantiable class
 *
 * 泛型参数 / Generic Parameter:
 * @template T 类实例的类型，默认为 any / Type of class instance, defaults to any
 *
 * 使用场景 / Use Cases:
 * 1. 工厂函数参数类型 / Factory function parameter type
 * 2. 依赖注入容器 / Dependency injection container
 * 3. 对象转换和序列化 / Object transformation and serialization
 * 4. 泛型类操作 / Generic class operations
 *
 * 使用示例 / Usage Examples:
 * ```typescript
 * // 1. 工厂函数 / Factory function
 * function createInstance<T>(clazz: ClassType<T>, ...args: any[]): T {
 *   return new clazz(...args);
 * }
 *
 * class User {
 *   constructor(public name: string) {}
 * }
 *
 * const user = createInstance(User, 'John'); // user: User
 *
 * // 2. 类型转换 / Type transformation
 * function transform<T>(clazz: ClassType<T>, data: any): T {
 *   const instance = new clazz();
 *   Object.assign(instance, data);
 *   return instance;
 * }
 *
 * // 3. 依赖注入 / Dependency injection
 * class Container {
 *   register<T>(clazz: ClassType<T>, instance: T) {
 *     // 注册服务 / Register service
 *   }
 *
 *   resolve<T>(clazz: ClassType<T>): T {
 *     // 解析依赖 / Resolve dependency
 *     return new clazz();
 *   }
 * }
 *
 * // 4. 装饰器元数据 / Decorator metadata
 * function Service() {
 *   return function<T>(target: ClassType<T>) {
 *     // 为类添加元数据 / Add metadata to class
 *   };
 * }
 * ```
 */
export type ClassType<T = any> = { new (...args: any[]): T };
