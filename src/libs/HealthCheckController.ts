import internalIp from 'internal-ip';
import os from 'os';
import { Get, JsonController, QueryParam } from 'routing-controllers';
import { Inject, Service } from 'typedi';
import { getConnectionManager } from 'typeorm';
import { Logger, RedisClient } from '.';

@JsonController()
@Service()
export class HealthCheckController {
  private logger = Logger.getLogger(HealthCheckController);

  @Inject(() => RedisClient)
  private redisClient: RedisClient;

  @Get('/_healthcheck')
  async healthCheck(@QueryParam('os') showOs: string) {
    const conn = getConnectionManager().get();
    const dbAlive = await conn.query('select "true"');
    // this.logger.info(`Checking is DB alive? ${dbAlive[0]['true']}`);
    const redisAlive = await this.redisClient.redis.ping('true');
    // this.logger.info(`Checking is redis alive? ${redisAlive}`);

    const healthy = dbAlive && redisAlive;

    if (showOs) {
      const osInfo = {
        hostname: os.hostname(),
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        cpus: `${os.cpus()[0].model} x ${os.cpus().length}`,
        networks: await internalIp.v4(),
      };
      return { healthy, osInfo };
    }
    return {
      healthy,
    };
  }
}
