import _ from 'lodash';
import { BizError } from './BizError';
import { ClassType } from './types';
import { UniversalService } from './UniversalService';

export type EntityMapOptions = {
  [name: string]: ClassType;
};

export class UniversalController {
  protected services: Record<string, UniversalService<any, any>> = {};

  protected options: EntityMapOptions;

  constructor(entityClasses: ClassType[]) {
    this.options = {};
    entityClasses.forEach((claz) => {
      this.options[claz.name] = claz;
    });
  }

  getEntityClass(entity: string) {
    const entityClass = this.options[entity];
    if (_.isNil(entityClass)) {
      throw new BizError('entity.notSupported');
    }
    return entityClass;
  }

  getUniversalService<Entity = any, ID = string>(entityClass: ClassType<Entity>) {
    let svc = this.services[entityClass.name];
    if (_.isNil(svc)) {
      svc = new UniversalService(entityClass);
      this.services[entityClass.name] = svc;
    }
    return svc as UniversalService<Entity, ID>;
  }
}
