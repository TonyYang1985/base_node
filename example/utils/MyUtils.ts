import _ from 'lodash';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ct, cv, i18n, PaginationIn } from '../../src';

@ct.Expose()
export class SearchVo extends PaginationIn {
  @ct.Expose()
  @i18n(cv.IsInt)
  @i18n(cv.IsOptional)
  pageIndex: number;

  @ct.Expose()
  @i18n(cv.IsInt)
  @i18n(cv.IsOptional)
  recordIndex: number;

  @ct.Expose()
  @i18n(cv.IsInt)
  @i18n(cv.IsOptional)
  pageSize: number;

  @ct.Expose()
  @i18n(cv.IsString)
  @i18n(cv.IsOptional)
  search: string;

  @ct.Expose()
  @i18n(cv.IsString)
  @i18n(cv.IsOptional)
  sort: string;
}

// ✅ 正确：extends 在泛型声明 <T> 里
export function selectFields<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, fields: Record<string, string>) {
  const arr: string[] = [];
  for (const key in fields) {
    arr.push(`${fields[key]} as '${key}'`);
  }
  if (!_.isEmpty(arr)) {
    qb.select(arr.join(', '));
  }
  return qb;
}

export function andWhereEqual<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string, field: string, value: string | number | Date) {
  if (!_.isNil(value)) {
    const conditions: Record<string, string | number | Date> = {};
    conditions[field] = value;
    qb.andWhere(`${alias}.${field} = :${field}`, conditions);
  }
  return qb;
}

export function andWhereWithSign<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string, field: string, sign: string, value: string | number | Date) {
  if (!_.isNil(value)) {
    const conditions: Record<string, string | number | Date> = {};
    conditions[field] = value;
    qb.andWhere(`${alias}.${field} ${sign} :${field}`, conditions);
  }
  return qb;
}

export function andWhereBetween<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string, field: string, value1: string | number | Date, value2: string | number | Date) {
  if (!_.isNil(value1) && !_.isNil(value2)) {
    const conditions: Record<string, string | number | Date> = {};
    conditions[`${field}1`] = value1;
    conditions[`${field}2`] = value2;
    qb.andWhere(`(${alias}.${field} >= :${field}1 and ${alias}.${field} <= :${field}2)`, conditions);
  }
  return qb;
}

export function multiSearch<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, fields: string[], keyWords: string) {
  if (!_.isNil(keyWords)) {
    let clauses: string[];
    let conditions: Record<string, string>;
    keyWords.split(' ').forEach((keyWord, idx) => {
      if (keyWord.length > 0) {
        clauses = [];
        conditions = {};
        for (const field of fields) {
          clauses.push(`${field} like :${field}_${idx}`);
          conditions[`${field}_${idx}`] = `%${keyWord}%`;
        }
        if (!_.isEmpty(clauses)) {
          qb.andWhere(`( ${clauses.join(' or ')} )`, conditions);
        }
      }
    });
  }
  return qb;
}

export function setSorts<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, fields: Record<string, string>, sorts: string) {
  if (sorts) {
    sorts.split(',').forEach((sort) => {
      if (sort) {
        sort = _.trim(sort, ' ');
        let seq: 'ASC' | 'DESC' | undefined = 'ASC';
        if (sort.startsWith('!')) {
          seq = 'DESC';
          sort = sort.substring(1);
        }
        if (_.has(fields, sort)) {
          qb.addOrderBy(fields[sort], seq);
        }
      }
    });
  }
  return qb;
}

export function andWhereIn<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string, field: string, values?: string[] | number[]) {
  if (!_.isNil(values) && !_.isEmpty(values)) {
    const conditions: Record<string, string[] | number[]> = {};
    conditions[field] = values;
    qb.andWhere(`${alias}.${field} IN (:...${field})`, conditions);
  }
  return qb;
}
