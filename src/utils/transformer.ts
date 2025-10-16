/**
 * 对象转换工具 / Object Transformation Utility
 *
 * 功能说明 / Description:
 * 基于 class-transformer 提供对象到类实例的转换功能，用于 DTO/VO 转换
 * Provides object-to-class-instance transformation based on class-transformer for DTO/VO conversion
 *
 * 主要功能 / Main Features:
 * 1. trans - 将普通对象转换为类实例 / Transform plain object to class instance
 * 2. transArray - 将对象数组转换为类实例数组 / Transform object array to class instance array
 * 3. @Transform - 方法装饰器，自动转换方法返回值 / Method decorator for auto-transforming return value
 * 4. @TransformArray - 数组转换装饰器 / Array transformation decorator
 * 5. groups - 创建转换分组配置 / Create transformation group config
 *
 * 使用场景 / Use Cases:
 * - RESTful API 响应数据转换 / RESTful API response data transformation
 * - 数据库实体到 VO 的映射 / Database entity to VO mapping
 * - 请求参数验证和转换 / Request parameter validation and transformation
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { trans, Transform } from './utils/transformer';
 *
 * // 类定义 / Class definition
 * class UserVo {
 *   @Expose() id: number;
 *   @Expose() name: string;
 *   password: string; // 不会被导出 / Won't be exported
 * }
 *
 * // 手动转换 / Manual transformation
 * const user = trans(UserVo, { id: 1, name: 'John', password: '123' });
 *
 * // 自动转换（控制器方法）/ Auto transformation (controller method)
 * @Transform(UserVo)
 * async getUser() {
 *   return await userService.findOne();
 * }
 * ```
 */
import { plainToClass } from 'class-transformer';
import { ClassType } from '../libs/type';

/**
 * 将普通对象转换为类实例 / Transform Plain Object to Class Instance
 *
 * @param claz 目标类构造函数 / Target class constructor
 * @param obj 要转换的普通对象 / Plain object to transform
 * @param groups 转换分组，用于控制哪些字段参与转换
 *               Transformation groups for controlling which fields to transform
 * @returns 类实例 / Class instance
 *
 * 功能说明 / Description:
 * 将普通 JS 对象转换为指定类的实例，只保留使用 @Expose() 装饰的字段
 * Transforms plain JS object to instance of specified class, keeping only @Expose() decorated fields
 *
 * 选项说明 / Options:
 * - excludeExtraneousValues: true - 只保留使用 @Expose() 装饰的字段
 *   Only keep fields decorated with @Expose()
 * - groups - 分组过滤，支持按场景导出不同字段
 *   Group filtering for exporting different fields by scenario
 *
 * 示例 / Example:
 * ```typescript
 * class UserVo {
 *   @Expose() id: number;
 *   @Expose() username: string;
 *   @Expose({ groups: ['admin'] }) email: string;
 * }
 *
 * // 基础转换 / Basic transformation
 * const user = trans(UserVo, { id: 1, username: 'john', email: 'john@example.com' });
 * // user 包含 id 和 username / user contains id and username
 *
 * // 分组转换 / Group transformation
 * const adminUser = trans(UserVo, data, ['admin']);
 * // adminUser 包含 id, username 和 email / contains id, username and email
 * ```
 */
export function trans<T>(claz: ClassType<T>, obj?: any, groups: string[] = []): T {
  return plainToClass(claz, obj, { excludeExtraneousValues: true, groups });
}

/**
 * 将对象数组转换为类实例数组 / Transform Object Array to Class Instance Array
 *
 * @param claz 目标类构造函数 / Target class constructor
 * @param objArray 要转换的对象数组 / Object array to transform
 * @param groups 转换分组 / Transformation groups
 * @returns 类实例数组 / Array of class instances
 * @throws 如果输入不是数组会抛出错误 / Throws error if input is not an array
 *
 * 示例 / Example:
 * ```typescript
 * const users = transArray(UserVo, [
 *   { id: 1, name: 'John' },
 *   { id: 2, name: 'Jane' }
 * ]);
 * // 返回 UserVo 实例数组 / Returns array of UserVo instances
 * ```
 */
export function transArray<T>(claz: ClassType<T>, objArray: any[], groups: string[] = []): T[] {
  if (Array.isArray(objArray)) {
    return plainToClass(claz, objArray, { excludeExtraneousValues: true, groups });
  } else {
    throw new Error('"transArray" accepts array only!');
  }
}

/**
 * 方法返回值转换装饰器 / Method Return Value Transformation Decorator
 *
 * @param claz 目标类构造函数 / Target class constructor
 * @param groups 转换分组 / Transformation groups
 * @returns 方法装饰器 / Method decorator
 *
 * 功能说明 / Description:
 * 自动将方法返回值转换为指定类的实例，支持同步和异步方法
 * Automatically transforms method return value to specified class instance, supports sync and async methods
 *
 * 应用场景 / Use Cases:
 * - 控制器方法自动转换响应 / Controller method auto-transforms response
 * - Service 层数据转换 / Service layer data transformation
 *
 * 示例 / Example:
 * ```typescript
 * class UserController {
 *   @Get('/user/:id')
 *   @Transform(UserVo)
 *   async getUser(@Param('id') id: number) {
 *     // 返回的数据库实体会自动转换为 UserVo
 *     // Returned database entity is auto-transformed to UserVo
 *     return await this.userService.findById(id);
 *   }
 *
 *   @Get('/admin/user/:id')
 *   @Transform(UserVo, 'admin')
 *   async getAdminUser(@Param('id') id: number) {
 *     // 使用 admin 分组，导出更多字段
 *     // Uses admin group to export more fields
 *     return await this.userService.findById(id);
 *   }
 * }
 * ```
 */
export function Transform(claz: ClassType, ...groups: string[]): MethodDecorator {
  return function (target: Record<string, any>, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    // 包装原方法 / Wrap original method
    descriptor.value = function (...args: any[]): any {
      // 执行原方法获取结果 / Execute original method to get result
      const result: any = originalMethod.apply(this, args);

      // 判断是否为 Promise / Check if result is a Promise
      const isPromise = !!result && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function';

      // 如果是 Promise，等待结果后转换；否则直接转换
      // If Promise, await and transform; otherwise transform directly
      return isPromise ? result.then((data: any) => trans(claz, data, groups)) : trans(claz, result, groups);
    };
  };
}

/**
 * 数组返回值转换装饰器 / Array Return Value Transformation Decorator
 *
 * @param claz 目标类构造函数 / Target class constructor
 * @param groups 转换分组 / Transformation groups
 * @returns 方法装饰器 / Method decorator
 *
 * 功能说明 / Description:
 * 自动将方法返回的数组转换为指定类的实例数组，支持同步和异步方法
 * Automatically transforms array returned by method to array of specified class instances
 *
 * 示例 / Example:
 * ```typescript
 * class UserController {
 *   @Get('/users')
 *   @TransformArray(UserVo)
 *   async getUsers() {
 *     // 返回的实体数组会自动转换为 UserVo 数组
 *     // Returned entity array is auto-transformed to UserVo array
 *     return await this.userService.findAll();
 *   }
 *
 *   @Get('/admin/users')
 *   @TransformArray(UserVo, 'admin')
 *   async getAdminUsers() {
 *     // 使用 admin 分组转换
 *     // Transform using admin group
 *     return await this.userService.findAll();
 *   }
 * }
 * ```
 */
export function TransformArray(claz: ClassType, ...groups: string[]): MethodDecorator {
  return function (target: Record<string, any>, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    // 包装原方法 / Wrap original method
    descriptor.value = function (...args: any[]): any[] {
      // 执行原方法获取结果 / Execute original method to get result
      const result: any = originalMethod.apply(this, args);

      // 判断是否为 Promise / Check if result is a Promise
      const isPromise = !!result && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function';

      // 如果是 Promise，等待结果后转换；否则直接转换
      // If Promise, await and transform; otherwise transform directly
      return isPromise ? result.then((data: any) => transArray(claz, data, groups)) : transArray(claz, result, groups);
    };
  };
}

/**
 * 创建转换分组配置 / Create Transformation Group Config
 *
 * @param groups 分组名称列表 / List of group names
 * @returns 转换选项对象 / Transformation options object
 *
 * 功能说明 / Description:
 * 创建 class-transformer 的转换选项，用于手动转换时指定分组
 * Creates class-transformer options for specifying groups during manual transformation
 *
 * 示例 / Example:
 * ```typescript
 * import { plainToClass } from 'class-transformer';
 * import { groups } from './transformer';
 *
 * const user = plainToClass(UserVo, data, groups('admin', 'detail'));
 * // 使用 admin 和 detail 分组转换
 * // Transform using admin and detail groups
 * ```
 */
export function groups(...groups: string[]) {
  return { groups, excludeExtraneousValues: true };
}
