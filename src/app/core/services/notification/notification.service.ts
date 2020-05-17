import { Injectable } from '@angular/core';
import {Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  protected subscriptions = {};

  /**
   * 发送广播
   * @param {string} event
   * @param payload
   */
  post(event: string, payload?: any) {
    let subject = this.subscriptions[event];
    if (!subject) {
      subject = new Subject<any>();
      this.subscriptions[event] = subject;
    }
    subject.next(payload);
  }

  /**
   * 接收广播
   * @param {string} event
   * @param {(value: any) => void} action
   */
  on(event: string, action: (value: any) => void) {
    let subject = this.subscriptions[event];
    if (!subject) {
      subject = new Subject<any>();
      this.subscriptions[event] = subject;
    }
    subject.asObservable().subscribe((data) => {
      action(data);
    });
  }

  /**
   * 移除广播
   * 在下一次遇到post/on方法再次监听
   * @param {string} event
   */
  off(event: string) {
    let subject = this.subscriptions[event];
    if (subject) {
      subject.complete();
      subject = null;
      delete this.subscriptions[event];
    }
  }
}
