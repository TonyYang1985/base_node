// {}
import { Service, Inject } from "typedi";
import { DataSource, Repository } from "typeorm";
import { Role } from "../entities";
import { RoleSearchVo } from "../vo/Roles";
import { andWhereEqual, multiSearch, selectFields, setSorts } from "example/utils/MyUtils";
import { skipAndTake } from "@/libs/pagination";

@Service()
export class RoleRepo extends Repository<Role> {
  constructor(@Inject("dataSource") dataSource: DataSource) {
    super(Role, dataSource.createEntityManager());
  }

  // Add your code herer
  async queryAllRoles(search: RoleSearchVo) {
    const qb = this.createQueryBuilder('role');
    const fields: Record<string, string> = {
      id: 'role.id',
      name: 'role.name',
      app: 'role.app',
      isDefault: 'role.isDefault',
      createdAt: 'role.createdAt',
      updatedAt: 'role.updatedAt',
    };
    selectFields(qb, fields);
    qb.where('role.isDel= 0');
    andWhereEqual(qb, 'role', 'app', search.app);
    multiSearch(qb, ['role.name', 'role.app'], search.search);
    setSorts(qb, fields, search.sort);
    const count = await qb.getCount();
    const { skip, take } = skipAndTake(count, search);
    const raws = await qb.offset(skip).limit(take).getRawMany();
    return { count, raws };
  }
}
