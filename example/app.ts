import 'reflect-metadata';
import { Container } from 'typedi';
import { ApiRegisterController, bootstrap, Leader } from '../src';
import * as rsControllers from './controllers';
import * as Entities from './entities';
import * as Handlers from './events';
import * as wsControllers from './wsControllers';

bootstrap({
  restfulControllers: [...Object.values(rsControllers), ApiRegisterController],
  wsControllers: Object.values(wsControllers),
  entities: Object.values(Entities),
  eventsHandlers: Object.values(Handlers),
})
  .then(async () => {
    await Container.get(Leader).config({ project: 'ExampleLeader' }).elect();
  })
  .catch((e) => {
    console.error(e);
  });
