import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {SettingComponent} from './setting.component';
import {SharedModule} from "../shared/shared.module";
import {UserComponent} from './component/user/user.component';
import { ProjectComponent } from './component/project/project.component';


@NgModule({
  declarations: [SettingComponent, UserComponent, ProjectComponent],
  imports: [CommonModule, SharedModule],
  exports: [SettingComponent]
})
export class SettingModule {
}
