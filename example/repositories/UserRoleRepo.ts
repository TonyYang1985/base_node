// {}
import { Service, Inject } from "typedi";
import { DataSource, Repository } from "typeorm";
import { UserRole } from "../entities";

@Service()
export class UserRoleRepo extends Repository<UserRole> {
  constructor(@Inject("dataSource") dataSource: DataSource) {
    super(UserRole, dataSource.createEntityManager());
  }

  // Add your code here
}
