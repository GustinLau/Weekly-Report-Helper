import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HomeRoutingModule} from './home-routing.module';
import {HomeComponent} from './home.component';
import {SharedModule} from '../shared/shared.module';
import {SettingModule} from "../setting/setting.module";

@NgModule({
  declarations: [HomeComponent],
  imports: [CommonModule, SharedModule, SettingModule, HomeRoutingModule]
})
export class HomeModule {
}
