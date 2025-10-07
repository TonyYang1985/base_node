import 'reflect-metadata';
import { ConnectedSocket, OnConnect, OnDisconnect, SocketController } from 'socket-controllers';
import SocketIO from 'socket.io';
import { Inject } from 'typedi';
import { UserService } from '../services/UserService';

@SocketController('/employees')
export class EmployeesWSController {
  @Inject()
  private userService!: UserService;

  @OnConnect()
  async connection(@ConnectedSocket() socket: SocketIO.Socket) {
    console.log('client connected');
    socket.emit('all', await this.userService.getAllUsers());
  }

  @OnDisconnect()
  disconnect(@ConnectedSocket() socket: SocketIO.Socket) {
    console.log('client disconnected');
    console.log('client connected', socket.id);
  }

  // @OnMessage('load')
  // async load(@ConnectedSocket() socket: SocketIO.Socket, @MessageBody() email: string) {
  //   const e = await this.userService.getOne(email);
  //   socket.emit('done', e);
  // }
}
