import { Inject, Service } from 'typedi';
import { onEvent } from '../../src';
import { UserService } from './../services/UserService';

@Service()
export class TestEventHandler {
  @Inject()
  userService: UserService;

  @onEvent('test.example')
  onTestEvent(param: any) {
    console.log(param);
    throw 'oh-my-god';
  }
}
