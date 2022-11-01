// {}
import { Service } from 'typedi';
import { EntityRepository, Repository } from 'typeorm';
import { CasbinRule } from '../entities';

@Service()
@EntityRepository(CasbinRule)
export class CasbinRuleRepo extends Repository<CasbinRule> {
  // Add your code herer
}
