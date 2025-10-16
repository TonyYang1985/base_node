/**
 * 业务错误类 / Business Error Class
 *
 * 功能说明 / Description:
 * 用于抛出业务逻辑相关的错误，支持国际化和参数化的错误消息
 * Used to throw business logic related errors with i18n and parameterized error messages
 *
 * 使用方法 / Usage:
 * ```typescript
 * // 简单错误消息 / Simple error message
 * throw new BizError('User not found');
 *
 * // 带 i18n 键的错误 / Error with i18n key
 * throw new BizError('error.user.not_found');
 *
 * // 带参数的错误消息 / Error message with parameters
 * throw new BizError(['error.user.invalid_email', { email: 'test@example.com' }]);
 *
 * // 带附加数据的错误 / Error with additional data
 * throw new BizError('error.permission.denied', { userId: 123, action: 'delete' });
 * ```
 *
 * 错误处理 / Error Handling:
 * - 框架会自动捕获 BizError 并返回统一的错误响应
 *   Framework automatically catches BizError and returns unified error response
 * - 错误消息支持国际化，根据请求的语言返回对应翻译
 *   Error messages support i18n, returns translation based on request language
 * - 可以包含额外的业务数据返回给客户端
 *   Can include additional business data to return to client
 */

/**
 * 消息类型 / Message Type
 * - string: 错误键或直接的错误消息 / Error key or direct error message
 * - Record<string, any>: 消息参数，用于替换占位符 / Message params for placeholder replacement
 */
export type TMessage = [string, Record<string, any>?];

/**
 * 业务错误类 / Business Error Class
 * 继承自标准 Error 类，添加了业务错误特定的属性
 * Extends standard Error class with business-specific properties
 */
export class BizError extends Error {
  /**
   * 错误标识 / Error flag
   * 用于区分业务错误和系统错误
   * Used to distinguish business errors from system errors
   */
  isError = true;

  /**
   * 附加数据 / Additional data
   * 可以包含任何需要返回给客户端的业务数据
   * Can contain any business data that needs to be returned to client
   *
   * 示例 / Example:
   * ```typescript
   * data: { userId: 123, requiredRole: 'admin' }
   * ```
   */
  data?: any;

  /**
   * 错误消息元组 / Error message tuple
   * 包含错误键和参数，用于国际化处理
   * Contains error key and parameters for i18n processing
   */
  errorMessage: TMessage;

  /**
   * HTTP 状态码 / HTTP status code
   * 默认 500，可以根据业务需要修改
   * Default 500, can be modified based on business needs
   */
  code = 500;

  /**
   * 构造函数 / Constructor
   * @param tMessage 错误消息或消息元组 / Error message or message tuple
   * @param data 附加数据 / Additional data
   *
   * 示例 / Examples:
   * ```typescript
   * // 字符串消息 / String message
   * new BizError('User not found')
   *
   * // 带参数的消息 / Message with params
   * new BizError(['error.user.age_invalid', { minAge: 18, maxAge: 65 }])
   *
   * // 带附加数据 / With additional data
   * new BizError('Permission denied', { requiredRole: 'admin' })
   * ```
   */
  constructor(tMessage: TMessage | string, data = {}) {
    // 调用父类构造函数，设置错误消息
    // Call parent constructor to set error message
    super(typeof tMessage === 'string' ? tMessage : tMessage[0]);

    // 保存附加数据 / Save additional data
    this.data = data;

    // 规范化错误消息格式 / Normalize error message format
    this.errorMessage = typeof tMessage !== 'string' ? tMessage : [tMessage];
  }
}
