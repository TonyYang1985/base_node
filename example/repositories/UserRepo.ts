// {}
import { Service, Inject } from "typedi";
import { DataSource, Repository } from "typeorm";
import { User } from "../entities";

@Service()
export class UserRepo extends Repository<User> {
  constructor(@Inject("dataSource") dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  // Add your code here
}
