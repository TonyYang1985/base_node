/**
 * 加密工具类 / Cryptography Utility Class
 *
 * 功能说明 / Description:
 * 提供常用的加密和哈希功能，包括 MD5、SHA1-HMAC 以及 RSA 密钥管理
 * Provides common encryption and hashing functions including MD5, SHA1-HMAC, and RSA key management
 *
 * 主要功能 / Main Features:
 * 1. md5 - MD5 哈希加密 / MD5 hash encryption
 * 2. sha1Hmac - SHA1-HMAC 签名 / SHA1-HMAC signature
 * 3. privateKey - 获取 RSA 私钥（带缓存）/ Get RSA private key (with cache)
 * 4. publicKey - 获取 RSA 公钥（带缓存）/ Get RSA public key (with cache)
 *
 * 密钥缓存 / Key Caching:
 * RSA 密钥会在首次读取后缓存在内存中，提高性能
 * RSA keys are cached in memory after first read for better performance
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { crypto } from './utils/crypto';
 *
 * // MD5 哈希 / MD5 hash
 * const hash = crypto.md5('password123');
 *
 * // SHA1-HMAC 签名 / SHA1-HMAC signature
 * const signature = crypto.sha1Hmac('data_to_sign');
 *
 * // 获取 RSA 密钥 / Get RSA keys
 * const privateKey = crypto.privateKey;
 * const publicKey = crypto.publicKey;
 * ```
 */
import { createHash, createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { ApplicationConfig, ConfigManager } from '../libs/configure';

/**
 * 密钥缓存接口 / Key Cache Interface
 */
interface KeyCache {
  /** RSA 私钥缓存 / RSA private key cache */
  privateKey?: string;
  /** RSA 公钥缓存 / RSA public key cache */
  publicKey?: string;
}

/**
 * 加密工具类 / Cryptography Utility Class
 */
class FotCrypto {
  /**
   * 密钥缓存对象 / Key cache object
   * 用于缓存从文件系统读取的 RSA 密钥，避免重复 I/O 操作
   * Used to cache RSA keys read from file system to avoid repeated I/O operations
   */
  private static readonly keyCache: KeyCache = {};

  /**
   * MD5 哈希加密 / MD5 Hash Encryption
   *
   * @param input 要加密的字符串 / String to encrypt
   * @returns 32 位十六进制 MD5 哈希值 / 32-character hexadecimal MD5 hash
   *
   * 应用场景 / Use Cases:
   * - 密码哈希（不推荐，建议使用 bcrypt）/ Password hashing (not recommended, use bcrypt)
   * - 文件完整性校验 / File integrity verification
   * - 快速数据指纹 / Quick data fingerprinting
   *
   * 示例 / Example:
   * ```typescript
   * const hash = crypto.md5('hello world');
   * console.log(hash); // "5eb63bbbe01eeed093cb22bb8f5acdc3"
   * ```
   */
  md5(input: string) {
    const md5 = createHash('md5');
    return md5.update(input).digest('hex');
  }

  /**
   * SHA1-HMAC 签名 / SHA1-HMAC Signature
   *
   * @param input 要签名的数据 / Data to sign
   * @returns 40 位十六进制 SHA1-HMAC 签名 / 40-character hexadecimal SHA1-HMAC signature
   *
   * 功能说明 / Description:
   * 使用私钥作为密钥，对输入数据进行 SHA1-HMAC 签名
   * Signs input data using SHA1-HMAC with private key as secret
   *
   * 应用场景 / Use Cases:
   * - API 请求签名 / API request signing
   * - 数据完整性验证 / Data integrity verification
   * - 防篡改保护 / Tamper protection
   *
   * 示例 / Example:
   * ```typescript
   * const signature = crypto.sha1Hmac('important_data');
   * console.log(signature); // "a3f2b1c4d5..."
   * ```
   */
  sha1Hmac(input: string): string {
    const hmac = createHmac('sha1', this.privateKey);
    hmac.update(input);
    return hmac.digest('hex');
  }

  /**
   * 获取 RSA 私钥 / Get RSA Private Key
   *
   * @returns RSA 私钥字符串（PEM 格式）/ RSA private key string (PEM format)
   *
   * 功能说明 / Description:
   * 从配置文件指定的路径读取 RSA 私钥，首次读取后会缓存在内存中
   * Reads RSA private key from path specified in config, caches in memory after first read
   *
   * 配置要求 / Configuration Requirements:
   * 需要在 application.yml 中配置 privateKeyPath
   * Requires privateKeyPath in application.yml
   *
   * 示例 / Example:
   * ```typescript
   * const privateKey = crypto.privateKey;
   * // 用于 JWT 签名等操作 / Used for JWT signing, etc.
   * ```
   */
  get privateKey(): string {
    const config = ConfigManager.getConfig<ApplicationConfig>('application');
    // 如果缓存中没有，从文件读取 / If not in cache, read from file
    if (!FotCrypto.keyCache.privateKey) {
      FotCrypto.keyCache.privateKey = readFileSync(config.privateKeyPath, 'ascii');
    }
    return FotCrypto.keyCache.privateKey;
  }

  /**
   * 获取 RSA 公钥 / Get RSA Public Key
   *
   * @returns RSA 公钥字符串（PEM 格式）/ RSA public key string (PEM format)
   *
   * 功能说明 / Description:
   * 从配置文件指定的路径读取 RSA 公钥，首次读取后会缓存在内存中
   * Reads RSA public key from path specified in config, caches in memory after first read
   *
   * 配置要求 / Configuration Requirements:
   * 需要在 application.yml 中配置 publicKeyPath
   * Requires publicKeyPath in application.yml
   *
   * 示例 / Example:
   * ```typescript
   * const publicKey = crypto.publicKey;
   * // 用于 JWT 验证等操作 / Used for JWT verification, etc.
   * ```
   */
  get publicKey(): string {
    const config = ConfigManager.getConfig<ApplicationConfig>('application');
    // 如果缓存中没有，从文件读取 / If not in cache, read from file
    if (!FotCrypto.keyCache.publicKey) {
      FotCrypto.keyCache.publicKey = readFileSync(config.publicKeyPath, 'ascii');
    }
    return FotCrypto.keyCache.publicKey;
  }
}

/**
 * 加密工具单例实例 / Crypto Utility Singleton Instance
 *
 * 可直接导入使用，无需手动实例化
 * Can be imported and used directly without manual instantiation
 */
export const crypto = new FotCrypto();
