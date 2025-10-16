// {}
import { Service, Inject } from "typedi";
import { DataSource, Repository } from "typeorm";
import { Role } from "../entities";

@Service()
export class RoleRepo extends Repository<Role> {
  constructor(@Inject("dataSource") dataSource: DataSource) {
    super(Role, dataSource.createEntityManager());
  }

  // Add your code here
}
