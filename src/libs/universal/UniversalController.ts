import _ from 'lodash';
import { ObjectLiteral } from 'typeorm'; // ✅ 添加导入
import { BizError } from '../error';
import { ClassType } from '../type';
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

  getUniversalService<Entity extends ObjectLiteral = any, ID = string>(entityClass: ClassType<Entity>) {
    // ✅ 添加约束
    let svc = this.services[entityClass.name];
    if (_.isNil(svc)) {
      svc = new UniversalService(entityClass);
      this.services[entityClass.name] = svc;
    }
    return svc as UniversalService<Entity, ID>;
  }
}
