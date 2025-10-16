// {}
import { Service, Inject } from "typedi";
import { DataSource, Repository } from "typeorm";
import { CasbinRule } from "../entities";

@Service()
export class CasbinRuleRepo extends Repository<CasbinRule> {
  constructor(@Inject("dataSource") dataSource: DataSource) {
    super(CasbinRule, dataSource.createEntityManager());
  }

  // Add your code here
}
