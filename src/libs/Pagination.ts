import { paginationCalculator } from 'pagination-calculator';
import { SelectQueryBuilder } from 'typeorm';
import { ct, cv } from '../deps/Libs';
import { transArray } from '../utils/transformer';
import { i18n } from './i18nValidator';
import { ClassType } from './types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snake = require('to-snake-case');

export const getCalculator = (totalRecords: number, pageIndex: number, pageSize: number) =>
  paginationCalculator({
    total: totalRecords,
    current: pageIndex,
    pageSize: pageSize,
  });

// export const skipAndTake = (totalRecords: number, pageIndex: number, pageSize: number) => {
//   const calculator = getCalculator(totalRecords, pageIndex, pageSize);
//   return {
//     skip: calculator.showingStart - 1,
//     take: pageSize,
//   };
// };

export const skipAndTake = (totalRecords: number, paginationIn: PaginationIn) => {
  if (paginationIn.pageIndex) {
    const calculator = getCalculator(totalRecords, paginationIn.pageIndex, paginationIn.pageSize);
    return {
      skip: calculator.showingStart - 1,
      take: paginationIn.pageSize,
    };
  } else {
    return { skip: paginationIn.recordIndex ?? 0, take: paginationIn.pageSize };
  }
};

export class PaginationOut<T, R> {
  data: T[];

  totalRecords: number;

  pageCount: number;

  constructor(totalRecords: number, pageSize: number, dataClass?: ClassType<T>, data?: R[], groups?: string[]) {
    const calculator = getCalculator(totalRecords, 1, pageSize);
    this.totalRecords = totalRecords;
    this.pageCount = calculator.pageCount;
    if (dataClass && data) {
      this.transform(dataClass, data, groups);
    }
  }

  transform(dataClass: ClassType<T>, data: R[], groups?: string[]) {
    this.data = transArray(dataClass, data, groups);
  }
}

@ct.Expose()
export class PaginationIn {
  @ct.Expose()
  @i18n(cv.IsOptional)
  @i18n(cv.IsNumber)
  pageIndex?: number;

  @ct.Expose()
  @i18n(cv.IsOptional)
  @i18n(cv.IsNumber)
  recordIndex?: number;

  @ct.Expose()
  @i18n(cv.IsOptional)
  @i18n(cv.IsNumber)
  pageSize = 25;

  @ct.Expose()
  @i18n(cv.IsOptional)
  @i18n(cv.IsString)
  search: string;

  @ct.Expose()
  @i18n(cv.IsOptional)
  @i18n(cv.IsString)
  sort: string;
}

export const setSorting = <T>(qb: SelectQueryBuilder<T>, alias: string, ...sorts: string[]) => {
  sorts.forEach((s) => {
    if (s) {
      if (s.startsWith('!')) {
        qb.orderBy(`${alias}.${snake(s.substring(1))}`, 'DESC');
      } else {
        qb.orderBy(`${alias}.${snake(s)}`, 'ASC');
      }
    }
  });
  return qb;
};

export const getSorting = (...sorts: string[]) => {
  const sort: Record<string, 'ASC' | 'DESC'> = {};
  sorts.forEach((s) => {
    if (s) {
      if (s.startsWith('!')) {
        sort[s.substring(1)] = 'DESC';
      } else {
        sort[s] = 'ASC';
      }
    }
  });
  return sort;
};
