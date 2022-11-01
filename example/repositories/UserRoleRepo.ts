// {}
import { Service } from 'typedi';
import { EntityRepository, Repository } from 'typeorm';
import { UserRole } from '../entities';

@Service()
@EntityRepository(UserRole)
export class UserRoleRepo extends Repository<UserRole> {
  // Add your code herer
}
