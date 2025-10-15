import { Inject, Service } from 'typedi';
import { InjectRepository } from 'typeorm-typedi-extensions';
import { PaginationOut, RedisClient } from '../../src';
import { RoleRepo, UserRepo } from '../repositories';
import { RoleResultVo, RoleSearchVo } from '../vo/Roles';
import { applyCache, createCache, getCache, L1Cache, L2Cache, removeCache, resetCache, updateCache } from './../../src';
import { User } from './../entities/User';

@Service()
export class Lifecycle {
  onStart() {}
}
@Service()
export class UserService extends Lifecycle {
  onStart() {
    console.log('onStart: UserService');
  }

  @InjectRepository()
  private repo: UserRepo;

  @InjectRepository()
  private roleRepo: RoleRepo;

  @Inject()
  private redisClient: RedisClient;

  @L1Cache({ ttlSeconds: async (get) => 25 })
  async getAllUsers() {
    return this.repo.find();
  }

  @L2Cache({ ttlSeconds: 25 })
  async getByEmail(email: string) {
    return this.repo.findOne({
      where: {
        email,
        isDel: 0,
      },
    });
  }

  async updateUser(user: User) {
    await this.repo.update(user.id, user);
  }

  async saveCache(email: string) {
    await createCache({ email }, async () => {
      return this.repo.findOne({
        where: {
          email,
          isDel: 0,
        },
        order: { app: 'ASC' },
      });
    });
  }

  async updateCache(email: string) {
    await updateCache({ email }, async (user?: User) => {
      if (user) {
        return new User({ ...user, lastSignIn: new Date() });
      }
    });
  }

  async removeCache(email: string) {
    await removeCache({ email });
  }

  async getCache(email: string) {
    return getCache({ email });
  }

  async idToName(email: string) {
    const user = await this.getByEmail(email);
    const cache = await this.getAllUsers();
    return applyCache(user, { value: 'matchedName' }, cache, { value: 'userName' });
  }

  async idToNameArray(email: string) {
    const user = await this.getByEmail(email);
    const cache = await this.getAllUsers();
    return applyCache([user, user, user], { value: 'matchedName' }, cache, { value: 'userName' });
  }

  async reset(email: string) {
    return resetCache(['UserService.getByEmail', email]);
  }

  async queryAllRoles(search: RoleSearchVo) {
    const { count, raws } = await this.roleRepo.queryAllRoles(search);
    return new PaginationOut(count, search.pageSize, RoleResultVo, raws, ['Display']);
  }
}
