import {Injectable} from '@angular/core';
import * as Store from 'electron-store'
import {User} from "../../model/user.model";
import {Project} from "../../model/project.model";

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  store: Store;

  constructor() {
    this.store = new Store()
  }

  getUserList(): User[] {
    return this.store.get('users', [])
  }

  setUserList(users: User[]) {
    this.store.set('users', users)
  }

  getProjectList(): Project[] {
    return this.store.get('projects', [])
  }

  setProjectList(projects: Project[]) {
    this.store.set('projects', projects)
  }
}
