import { Expose } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Body, CurrentUser, Param, QueryParam, QueryParams } from 'routing-controllers';
import { ResponseSchema } from 'routing-controllers-openapi';
import { Inject } from 'typedi';
import { BizError, Delete, Get, i18n, JsonController, L1Cache, Logger, PaginationIn, Post, Put, Transform, UniversalController, ValidationHelper } from '../../src/index';
import { Role, User } from '../entities';
import { UserService } from '../services/UserService';
import { RoleSearchVo } from '../vo/Roles';
import { UserVo } from '../vo/UserVo';

class Who {
  @i18n(IsString)
  @i18n(IsOptional)
  @i18n(MaxLength, 3)
  name?: string;

  @i18n(IsString)
  @i18n(MaxLength, 1, 2)
  name1?: string;
}

class WhoResponse {
  @IsString()
  hi: string;
}

@Expose()
class UserSearch extends PaginationIn {
  @Expose()
  app: string;

  @Expose()
  userName: string;
}

@JsonController()
export class UserController extends UniversalController {
  private logger = Logger.getLogger(UserController);

  constructor() {
    super([User, Role]);
  }

  @Inject()
  private userService: UserService;

  @Post('/crud/user')
  async createUser(@Body() user: UserVo) {
    user.isLocked = 0;
    await this.getUniversalService(User).create(user);
  }

  @Get('/crud/user/:id')
  @Transform(UserVo)
  async getUser(@Param('id') id: string) {
    return this.getUniversalService(User).readById(id);
  }

  @Put('/crud/user/:id')
  async modifyUser(@Param('id') id: string, @Body() user: UserVo) {
    return this.getUniversalService(User).update(id, user);
  }

  @Delete('/crud/user/:id')
  async removeUser(@Param('id') id: string) {
    return this.getUniversalService(User).remove(id);
  }

  @Get('/crud/allUsers')
  @L1Cache({ ttlSeconds: 10 })
  async getAllUsers() {
    return this.getUniversalService(User).getAll(UserVo);
  }

  @Get('/crud/user')
  async queryUser(@QueryParams() search: UserSearch) {
    return this.getUniversalService(User).query(search, {
      voClass: UserVo,
      searchColumns: ['userName', 'email'],
      filterGenerator: (key, filter, clauses, conditions) => {
        if (key === 'userName') {
          clauses.push(`_tb.${key} like :__${key}`);
          conditions[`__${key}`] = `%${filter[key]}%`;
          return true;
        }
        return false;
      },
    });
  }

  @Get('/all', '*', 'example')
  async allUsers(@QueryParam('email') email: string, @QueryParam('reset') reset: string, @QueryParam('cache') cache: string, @QueryParam('update') update: string, @QueryParam('del') del: string) {
    if (reset) {
      return this.userService.reset(email);
    } else if (cache) {
      return this.userService.saveCache(email);
    } else if (update) {
      return this.userService.updateCache(email);
    } else if (del) {
      return this.userService.removeCache(email);
    } else {
      return {
        autoSync: await this.userService.getCache(email),
        l1: await this.userService.getByEmail(email),
        l2: await this.userService.getAllUsers(),
        idToName: await this.userService.idToName(email),
        idToNameArray: await this.userService.idToNameArray(email),
      };
    }
  }

  @Get('/actions/who', '*', 'example')
  async whoami1(@CurrentUser() token: any) {
    if (!token) {
      throw new BizError('No Token!');
    }
    return `token: ${token}`;
  }

  @Get('/hello/:who', '*', 'example')
  async whoami2(@Param('who') name: string) {
    return { myName: `Your name: ${name}` };
  }

  @Post('/hello')
  @ResponseSchema(WhoResponse)
  async whoami3(@Body() who: Who) {
    const resp = new WhoResponse();
    resp.hi = `Hi, ${who.name}`;
    return resp;
  }

  @Get('/query/roles', 'admin', 'system.role')
  @ResponseSchema(WhoResponse)
  async queryRoles(@QueryParams() search: RoleSearchVo) {
    return this.userService.queryAllRoles(search);
  }

  @Post('/error')
  async thisApiWillThrowAnError() {
    // throw new BizError(
    //     {
    //         key: 'err.msg.key',
    //         param: {
    //             name: 'abc',
    //         },
    //     },
    //     {
    //         dataKey: 'test',
    //     },
    // );
    // throw 'I am a string error';
    await ValidationHelper.check({
      result: false,
      property: 'none',
      msgKey: 'test.msg.key',
      param: { p1: 'a msg t param' },
    });
  }
}
