/**
 * 分布式事件系统 / Distributed Event System
 *
 * 功能说明 / Description:
 * 基于 RabbitMQ 实现的分布式事件发布/订阅系统，用于微服务之间的异步通信
 * RabbitMQ-based distributed event pub/sub system for async communication between microservices
 *
 * 使用场景 / Use Cases:
 * - 跨服务的事件通知 / Cross-service event notifications
 * - 异步任务触发 / Async task triggering
 * - 数据同步 / Data synchronization
 * - 解耦服务依赖 / Decouple service dependencies
 *
 * 架构设计 / Architecture:
 * - Topic Exchange: 基于主题模式的消息路由 / Topic-based message routing
 * - Dead Letter Queue: 失败消息的死信队列 / Dead letter queue for failed messages
 * - Durable Queues: 持久化队列，消息不会丢失 / Durable queues to prevent message loss
 *
 * 使用方法 / Usage:
 * ```typescript
 * import { DistributedEvents } from './DistributedEvents';
 *
 * // 初始化事件系统 / Initialize event system
 * const events = await DistributedEvents.open(
 *   { connection: 'amqp://localhost' },
 *   'my-service-queue'
 * );
 *
 * // 订阅事件 / Subscribe to events
 * await events.sub(['user.created', 'user.updated', 'order.*']);
 *
 * // 监听远程事件 / Listen to remote events
 * events.on('RemoteEvent', (eventName, data) => {
 *   console.log(`Received ${eventName}:`, data);
 * });
 *
 * // 发布事件 / Publish events
 * await events.pub('user.created', { userId: 123, name: 'John' });
 *
 * // 关闭连接 / Close connection
 * await events.close();
 * ```
 *
 * 事件命名规范 / Event Naming Convention:
 * - 使用点号分隔的层级结构 / Use dot-separated hierarchical structure
 * - 示例: 'user.created', 'order.paid', 'inventory.updated'
 * - 支持通配符: 'user.*' (匹配所有 user 事件) / Supports wildcards
 */

import amqp from 'amqplib';
import EventEmitter from 'eventemitter3';
import { Service } from 'typedi';
import { Logger } from '../logger';

/**
 * RabbitMQ 连接配置 / RabbitMQ Connection Configuration
 */
export type RabbitMQConfig = {
  /** RabbitMQ 连接字符串 / RabbitMQ connection string */
  connection: string;
};

/**
 * 业务事件交换机名称 / Business events exchange name
 * Topic 类型，支持路由模式匹配 / Topic type, supports routing pattern matching
 */
const EVENTS_EXCHANGE = 'BizEvents';

/**
 * 死信交换机名称 / Dead letter exchange name
 * 接收处理失败的消息 / Receives failed messages
 */
const DEAD_LETTER_EXCHANGE = 'BizEventDeadLetter';

/**
 * 死信队列名称 / Dead letter queue name
 * 存储所有处理失败的消息 / Stores all failed messages
 */
const DEAD_LETTER_QUEUE = 'DeadLetters';

/**
 * 死信路由键 / Dead letter routing key
 * 用于将失败消息路由到死信队列 / Routes failed messages to dead letter queue
 */
const DEAD_LETTER_ROUTING_KEY = 'DeadLetter';

/**
 * 分布式事件服务类 / Distributed Events Service Class
 * 继承 EventEmitter，支持本地事件监听 / Extends EventEmitter for local event listening
 */
@Service()
export class DistributedEvents extends EventEmitter {
  /** 日志记录器 / Logger */
  private logger = Logger.getLogger(DistributedEvents);

  /**
   * RabbitMQ 通道 / RabbitMQ channel
   * 用于发布和订阅消息 / Used for publishing and subscribing messages
   */
  private channel: amqp.Channel;

  /**
   * 队列名称 / Queue name
   * 当前服务的消息队列名称 / Message queue name for current service
   */
  private queueName: string;

  /**
   * 打开并初始化事件系统 / Open and initialize event system
   * @param config RabbitMQ 连接配置 / RabbitMQ connection config
   * @param queueName 队列名称 (建议使用服务名) / Queue name (recommend using service name)
   * @returns DistributedEvents 实例 / DistributedEvents instance
   *
   * 初始化步骤 / Initialization Steps:
   * 1. 连接 RabbitMQ 服务器 / Connect to RabbitMQ server
   * 2. 创建通道 / Create channel
   * 3. 声明死信交换机和队列 / Declare dead letter exchange and queue
   * 4. 声明服务队列 (配置死信转发) / Declare service queue (with dead letter routing)
   * 5. 声明业务事件交换机 / Declare business events exchange
   * 6. 绑定死信队列 / Bind dead letter queue
   *
   * 示例 / Example:
   * ```typescript
   * const events = await DistributedEvents.open(
   *   { connection: 'amqp://user:pass@localhost:5672' },
   *   'user-service'
   * );
   * ```
   */
  static async open(config: RabbitMQConfig, queueName: string) {
    // 连接 RabbitMQ / Connect to RabbitMQ
    const conn = await amqp.connect(config.connection);
    const channel = await conn.createChannel();

    // 创建实例 / Create instance
    const events = new DistributedEvents();
    events.channel = channel;
    events.queueName = queueName;

    // 声明死信交换机 (Direct 类型) / Declare dead letter exchange (Direct type)
    await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'direct', { durable: true });

    // 声明服务队列，配置死信转发 / Declare service queue with dead letter routing
    await channel.assertQueue(queueName, {
      durable: true,  // 持久化队列 / Durable queue
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,     // 死信交换机 / Dead letter exchange
        'x-dead-letter-routing-key': DEAD_LETTER_ROUTING_KEY, // 死信路由键 / Dead letter routing key
      },
    });

    // 声明死信队列 / Declare dead letter queue
    await channel.assertQueue(DEAD_LETTER_QUEUE, {
      durable: true,
    });

    // 声明业务事件交换机 (Topic 类型) / Declare business events exchange (Topic type)
    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });

    // 绑定死信队列到死信交换机 / Bind dead letter queue to dead letter exchange
    await channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, DEAD_LETTER_ROUTING_KEY);

    return events;
  }

  /**
   * 订阅事件 / Subscribe to events
   * @param events 事件模式数组，支持通配符 / Event pattern array, supports wildcards
   *
   * 通配符说明 / Wildcard Explanation:
   * - '*' 匹配一个单词 / Matches exactly one word
   *   例如: 'user.*' 匹配 'user.created', 'user.updated'
   * - '#' 匹配零个或多个单词 / Matches zero or more words
   *   例如: 'user.#' 匹配 'user', 'user.created', 'user.profile.updated'
   *
   * 消息处理流程 / Message Processing Flow:
   * 1. 绑定队列到事件交换机 / Bind queue to events exchange
   * 2. 开始消费消息 / Start consuming messages
   * 3. 解析消息并触发本地 RemoteEvent 事件 / Parse message and emit local RemoteEvent
   * 4. 成功处理后 ACK / ACK after successful processing
   * 5. 处理失败则 Reject (首次重试，第二次进入死信队列)
   *    Reject on failure (retry once, then move to dead letter queue)
   *
   * 示例 / Example:
   * ```typescript
   * await events.sub(['user.created', 'user.*.profile', 'order.#']);
   * ```
   */
  async sub(events: string[]) {
    // 将队列绑定到所有指定的事件模式 / Bind queue to all specified event patterns
    await Promise.all(events.map((event) => this.channel.bindQueue(this.queueName, EVENTS_EXCHANGE, event)));

    // 开始消费队列消息 / Start consuming queue messages
    this.channel.consume(this.queueName, (msg: any) => {
      if (msg) {
        // 提取事件名和数据 / Extract event name and data
        const eventName = msg?.properties?.headers['x-eventName'];
        const content = msg.content.toString();
        const data = JSON.parse(content);

        try {
          this.logger.debug(`Received event: ${eventName}, Content: ${content}`);

          // 触发本地事件 / Emit local event
          this.emit('RemoteEvent', eventName, data);

          // 确认消息已处理 / Acknowledge message processed
          this.channel.ack(msg);
        } catch (error) {
          this.logger.debug(`Message rejected: ${eventName} with error: ${error}`);

          // 拒绝消息 / Reject message
          // !msg.fields.redelivered: 如果是首次投递则重新入队，否则进入死信队列
          // If first delivery, requeue; otherwise move to dead letter queue
          this.channel.reject(msg, !msg.fields.redelivered);
        }
      }
    });
  }

  /**
   * 发布事件 / Publish event
   * @param event 事件名称 / Event name
   * @param data 事件数据 / Event data
   *
   * 消息选项说明 / Message Options Explanation:
   * - contentEncoding: UTF-8 编码 / UTF-8 encoding
   * - contentType: JSON 格式 / JSON format
   * - deliveryMode: 2 表示持久化消息 / 2 means persistent message
   * - headers: 自定义头部，包含事件名 / Custom headers with event name
   *
   * 注意 / Note:
   * - 此方法不保证消息已被消费，仅保证发送到交换机
   *   This method doesn't guarantee message consumption, only delivery to exchange
   * - 消息持久化后即使 RabbitMQ 重启也不会丢失
   *   Persistent messages won't be lost even if RabbitMQ restarts
   *
   * 示例 / Example:
   * ```typescript
   * await events.pub('user.created', {
   *   userId: 123,
   *   email: 'user@example.com',
   *   createdAt: new Date()
   * });
   * ```
   */
  async pub<T = unknown>(event: string, data: T) {
    this.channel.publish(
      EVENTS_EXCHANGE,                      // 发布到业务事件交换机 / Publish to business events exchange
      event,                                 // 路由键 (事件名) / Routing key (event name)
      Buffer.from(JSON.stringify(data)),    // 消息体 (JSON 序列化) / Message body (JSON serialized)
      {
        contentEncoding: 'UTF-8',           // 字符编码 / Character encoding
        contentType: 'text/json',           // 内容类型 / Content type
        deliveryMode: 2,                    // 持久化消息 / Persistent message
        headers: {
          'x-eventName': event,             // 事件名存储在头部 / Event name in headers
        },
      }
    );
  }

  /**
   * 关闭通道连接 / Close channel connection
   *
   * 注意 / Note:
   * - 应在应用关闭时调用，确保资源正确释放
   *   Should be called on app shutdown to ensure proper resource cleanup
   * - 关闭通道后无法再发布或订阅消息
   *   Cannot publish or subscribe messages after closing
   */
  async close() {
    await this.channel.close();
  }
}
