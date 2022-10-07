import { MicroframeworkSettings } from 'microframework';
import { Container } from 'typedi';
import { ApplicationConfig, EventsManager } from '.';
import { ConfigManager } from './ConfigManager';
import { DistributedEvents, RabbitMQConfig } from './DistributedEvents';
import { Logger } from './Logger';
import { ClassType } from './types';

export type DistributedEventsLoaderOption = {
  eventsHandlers?: ClassType[];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const distributedEventsLoader = (option: DistributedEventsLoaderOption) => (settings?: MicroframeworkSettings) => {
  const appCfg = ConfigManager.getConfig<ApplicationConfig>('application');
  const rabbitmqCfg = ConfigManager.getConfig<RabbitMQConfig>('rabbitmq');
  return DistributedEvents.open(rabbitmqCfg, appCfg.appName).then((events) => {
    Container.set(DistributedEvents, events);
    settings?.onShutdown(async () => events.close());
    return EventsManager.start(events, option.eventsHandlers).then(() => {
      Logger.getLogger('DistributedEventsLoader').info(`🔗RabbitMQ connected.`);
    });
  });
};
