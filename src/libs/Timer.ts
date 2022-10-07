import { EventEmitter } from 'eventemitter3';
import _ from 'lodash';

export const TIME_EVENT = 'FmkTimer.TimeIsUp';

type Handlers = Record<string, () => any>;

export class FmkTimer extends EventEmitter {
  timer: Record<number, [NodeJS.Timer, Handlers]> = {};

  private start(interval = 1) {
    const time = interval * 1000;
    if (!this.timer[time]) {
      this.timer[time] = [
        setInterval(() => {
          this.emit(`${TIME_EVENT}#${interval}s`);
        }, time),
        {},
      ];
    }
  }

  stop() {
    Object.values(this.timer)
      .map((v) => v[0])
      .forEach(clearInterval);
  }

  offTimer(name: string) {
    Object.values(this.timer)
      .map((v) => v[1])
      .filter((handler) => {
        return !_.isNil(handler[name]);
      })
      .forEach((handler) => {
        delete handler[name];
      });
    Object.keys(this.timer)
      .filter((key: any) => {
        return Object.keys(this.timer[key][1]).length === 0;
      })
      .forEach((key: any) => {
        clearInterval(this.timer[key][0]);
        delete this.timer[key];
      });
  }

  onTimer(name: string, callback: () => any, interval = 1) {
    const time = interval * 1000;
    if (!this.timer[time]) {
      this.start(interval);
      this.on(`${TIME_EVENT}#${interval}s`, () => {
        Promise.all(Object.values(this.timer[time][1]).map((cb) => Promise.resolve(cb())));
      });
    }
    this.timer[time][1][name] = callback;
  }
}

export const fmkTimer = new FmkTimer();
