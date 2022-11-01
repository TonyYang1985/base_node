import { IsArray, Length } from 'class-validator';
import { ct, cv, i18n, PaginationIn } from './../../src';

@ct.Expose()
export class AssignRolesToUser {
  @i18n(Length, 1, 128)
  @ct.Expose()
  app: string;

  @i18n(IsArray)
  @i18n(Length, 1, 10, {
    each: true,
  })
  @ct.Expose()
  roleIds: string[];
}

@ct.Expose()
export class AssignFunctionsToRole {
  @i18n(Length, 1, 128)
  @ct.Expose()
  app: string;

  @i18n(IsArray)
  @i18n(Length, 1, 128, {
    each: true,
  })
  @ct.Expose()
  functions: string[];
}

@ct.Expose()
export class AssignMenusToRole {
  @i18n(Length, 1, 128)
  @ct.Expose()
  app: string;

  @i18n(IsArray)
  @i18n(Length, 1, 128, {
    each: true,
  })
  @ct.Expose()
  funcs: string[];
}
@ct.Expose()
export class AssignUsersToRole {
  @i18n(Length, 1, 128)
  @ct.Expose()
  app: string;

  @i18n(IsArray)
  @i18n(Length, 1, 128, {
    each: true,
  })
  @ct.Expose()
  userIds: string[];
}

@ct.Expose()
export class RoleVo {
  @ct.Expose({ groups: ['Display'] })
  id: string;

  @i18n(cv.IsString)
  @i18n(cv.Length, 1, 32)
  @ct.Expose({ groups: ['Display', 'Edit'] })
  name: string;

  @i18n(cv.IsString)
  @i18n(cv.Length, 1, 32)
  @ct.Expose({ groups: ['Display', 'Edit'] })
  app: string;

  @i18n(cv.IsNumber)
  @i18n(cv.IsIn, [0, 1])
  @cv.IsOptional()
  @ct.Expose({ groups: ['Display', 'Edit'] })
  isDefault: number;

  @ct.Expose({ groups: ['Display'] })
  createdAt: Date;

  @ct.Expose({ groups: ['Display'] })
  updatedAt: Date;
}

@ct.Expose()
export class RoleSearchVo extends PaginationIn {
  @ct.Expose()
  app: string;
}

export class RoleResultVo {
  @ct.Expose({ groups: ['Display'] })
  id: string;

  @ct.Expose({ groups: ['Display', 'Edit'] })
  name: string;

  @ct.Expose({ groups: ['Display'] })
  app: string;

  @ct.Expose({ groups: ['Display'] })
  isDefault: number;

  @ct.Expose({ groups: ['Display'] })
  createdAt: Date;

  @ct.Expose({ groups: ['Display'] })
  updatedAt: Date;
}
