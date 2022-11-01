// {}
import { Service } from 'typedi';
import { EntityRepository, Repository } from 'typeorm';
import { User } from '../entities';

@Service()
@EntityRepository(User)
export class UserRepo extends Repository<User> {
  // Add your code herer
}
