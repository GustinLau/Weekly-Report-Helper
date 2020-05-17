import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageNotFoundComponent} from './components/';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {
  NzButtonModule,
  NzIconModule,
  NzStepsModule,
  NzCheckboxModule,
  NzInputModule,
  NzUploadModule,
  NzTableModule,
  NzTabsModule,
  NzAlertModule,
  NzMessageModule,
  NzMessageServiceModule,
  NzModalModule, NzFormModule, NzResultModule
} from 'ng-zorro-antd';
import {IconDefinition} from '@ant-design/icons-angular';

import {
  LoadingOutline,
  SmileOutline,
  BarChartOutline,
  SmileTwoTone,
  InboxOutline,
  DownloadOutline
} from '@ant-design/icons-angular/icons';

const icons: IconDefinition[] = [LoadingOutline, SmileOutline, BarChartOutline, SmileTwoTone, InboxOutline, DownloadOutline];

const antdModule = [
  NzButtonModule,
  NzFormModule,
  NzStepsModule,
  NzCheckboxModule,
  NzInputModule,
  NzUploadModule,
  NzTableModule,
  NzTabsModule,
  NzAlertModule,
  NzMessageModule,
  NzMessageServiceModule,
  NzResultModule,
  NzModalModule];

@NgModule({
  declarations: [PageNotFoundComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NzIconModule.forRoot(icons), ...antdModule],
  exports: [FormsModule, ReactiveFormsModule, NzIconModule, ...antdModule]
})
export class SharedModule {
}
