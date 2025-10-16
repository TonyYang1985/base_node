/**
 * JWT 工具类 / JWT Utility Class
 *
 * 功能说明 / Description:
 * 提供 JWT (JSON Web Token) 的签发、验证、解码等功能，使用 RSA 非对称加密
 * Provides JWT (JSON Web Token) issuance, verification, and decoding using RSA asymmetric encryption
 *
 * 主要功能 / Main Features:
 * 1. issueToken - 签发 JWT 令牌 / Issue JWT token
 * 2. verifyToken - 验证 JWT 令牌 / Verify JWT token
 * 3. decodeToken - 解码 JWT 令牌（不验证）/ Decode JWT token (without verification)
 * 4. decodeJwt - 从 Authorization 头解码 JWT / Decode JWT from Authorization header
 *
 * 加密算法 / Encryption Algorithm:
 * 默认使用 RS256 (RSA Signature with SHA-256)
 * Uses RS256 (RSA Signature with SHA-256) by default
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { jwtUtil } from './utils/jwtUtil';
 *
 * // 签发令牌 / Issue token
 * const token = jwtUtil.issueToken({ userId: 123, role: 'admin' });
 *
 * // 验证令牌 / Verify token
 * const payload = jwtUtil.verifyToken(token);
 *
 * // 从请求头解码 / Decode from header
 * const data = jwtUtil.decodeJwt(req.headers.authorization, true);
 * ```
 */
import jwt from 'jsonwebtoken';
import _ from 'lodash';
import { crypto } from './crypto';

/**
 * JWT 工具类 / JWT Utility Class
 */
class JwtUtil {
  /**
   * 签发 JWT 令牌 / Issue JWT Token
   *
   * @param payload 要编码的数据载荷 / Data payload to encode
   * @param options JWT 签名选项，默认使用 RS256 算法
   *                JWT sign options, defaults to RS256 algorithm
   * @returns 签名后的 JWT 字符串 / Signed JWT string
   *
   * 示例 / Example:
   * ```typescript
   * const token = jwtUtil.issueToken(
   *   { userId: 123, role: 'admin' },
   *   { expiresIn: '7d' }
   * );
   * ```
   */
  issueToken(payload: Record<string, unknown>, options: jwt.SignOptions = { algorithm: 'RS256' }) {
    const privateKey = crypto.privateKey;
    return jwt.sign(payload, privateKey, options);
  }

  /**
   * 验证 JWT 令牌 / Verify JWT Token
   *
   * @param token 要验证的 JWT 字符串 / JWT string to verify
   * @param options JWT 验证选项，默认使用 RS256 算法
   *                JWT verify options, defaults to RS256 algorithm
   * @returns 解码后的载荷数据 / Decoded payload data
   * @throws 如果令牌无效或已过期会抛出错误
   *         Throws error if token is invalid or expired
   *
   * 示例 / Example:
   * ```typescript
   * try {
   *   const payload = jwtUtil.verifyToken(token);
   *   console.log(payload.userId); // 123
   * } catch (error) {
   *   console.error('Token验证失败', error);
   * }
   * ```
   */
  verifyToken(token: string, options: jwt.VerifyOptions = { algorithms: ['RS256'] }) {
    const publicKey = crypto.publicKey;
    return jwt.verify(token, publicKey, options) as Record<string, string>;
  }

  /**
   * 解码 JWT 令牌（不验证签名）/ Decode JWT Token (without signature verification)
   *
   * @param token 要解码的 JWT 字符串 / JWT string to decode
   * @param options 解码选项 / Decode options
   * @returns 解码后的载荷数据或完整令牌信息
   *          Decoded payload data or complete token info
   *
   * 注意 / Note:
   * 此方法不验证签名，仅用于快速读取令牌内容，不应用于安全验证
   * This method does not verify signature, only for quick reading, not for security validation
   *
   * 示例 / Example:
   * ```typescript
   * const payload = jwtUtil.decodeToken(token);
   * console.log(payload); // { userId: 123, role: 'admin', ... }
   * ```
   */
  decodeToken(token: string, options: jwt.DecodeOptions = { complete: false }) {
    return jwt.decode(token, options);
  }

  /**
   * 从 Authorization 头解码 JWT / Decode JWT from Authorization Header
   *
   * @param authorization Authorization 头的值，支持 "Bearer xxx" 格式
   *                      Authorization header value, supports "Bearer xxx" format
   * @param verify 是否验证签名，默认 false / Whether to verify signature, default false
   * @param options 验证选项（当 verify=true 时生效）
   *                Verify options (effective when verify=true)
   * @returns 解码后的载荷数据 / Decoded payload data
   *
   * 支持格式 / Supported Formats:
   * - "Bearer eyJhbGc..." - 标准 Bearer Token 格式
   * - "eyJhbGc..." - 直接的 JWT 字符串
   *
   * 示例 / Example:
   * ```typescript
   * // 不验证，仅解码 / Decode without verification
   * const payload = jwtUtil.decodeJwt(req.headers.authorization);
   *
   * // 验证并解码 / Verify and decode
   * const payload = jwtUtil.decodeJwt(req.headers.authorization, true);
   * ```
   */
  decodeJwt(authorization: string, verify = false, options: jwt.VerifyOptions = { algorithms: ['RS256'] }) {
    // 去除首尾空白 / Trim whitespace
    const authStr = _.trim(authorization);
    let token: any;
    let tokenStr = authStr;

    // 如果是 Bearer Token 格式，提取实际的 token
    // If it's Bearer Token format, extract the actual token
    if (authStr.startsWith('Bearer ')) {
      // 移除 "Bearer " 前缀 / Remove "Bearer " prefix
      tokenStr = authStr.slice(7, authStr.length);
    }

    // 如果 token 存在，进行解码或验证
    // If token exists, decode or verify it
    if (!_.isNil(tokenStr)) {
      if (verify) {
        // 验证并解码 / Verify and decode
        token = this.verifyToken(tokenStr, options);
      } else {
        // 仅解码，不验证 / Decode only, no verification
        token = this.decodeToken(tokenStr);
      }
    }
    return token;
  }
}

/**
 * JWT 工具单例实例 / JWT Utility Singleton Instance
 *
 * 可直接导入使用，无需手动实例化
 * Can be imported and used directly without manual instantiation
 */
export const jwtUtil = new JwtUtil();
