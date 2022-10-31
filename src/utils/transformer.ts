import { plainToInstance } from 'class-transformer';
import { ClassType } from '../libs/types';

export function trans<T>(claz: ClassType<T>, obj?: any, groups: string[] = []): T {
  // const inst = new claz();
  // Object.assign(inst, obj);
  return plainToInstance(claz, obj, { excludeExtraneousValues: true, groups });
}

export function transArray<T>(claz: ClassType<T>, objArray: any[], groups: string[] = []): T[] {
  if (Array.isArray(objArray)) {
    return plainToInstance(claz, objArray, { excludeExtraneousValues: true, groups });
  } else {
    throw new Error('"transArray" accepts array only!');
  }
}

export function Transform(claz: ClassType, ...groups: string[]): MethodDecorator {
  return function (target: Record<string, any>, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]): any {
      const result: any = originalMethod.apply(this, args);
      const isPromise = !!result && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function';
      return isPromise ? result.then((data: any) => trans(claz, data, groups)) : trans(claz, result, groups);
    };
  };
}

export function TransformArray(claz: ClassType, ...groups: string[]): MethodDecorator {
  return function (target: Record<string, any>, propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]): any[] {
      const result: any = originalMethod.apply(this, args);
      const isPromise = !!result && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function';
      return isPromise ? result.then((data: any) => transArray(claz, data, groups)) : transArray(claz, result, groups);
    };
  };
}

export function groups(...groups: string[]) {
  return { groups, excludeExtraneousValues: true };
}
