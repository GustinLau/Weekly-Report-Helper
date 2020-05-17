import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'app-setting',
  templateUrl: './setting.component.html',
  styleUrls: ['./setting.component.css']
})
export class SettingComponent implements OnInit {
  currentTab: number;
  private _show: boolean;

  constructor() {

  }

  ngOnInit(): void {
    this.currentTab = 0;
  }


  get show(): boolean {
    return this._show;
  }

  @Input()
  set show(value: boolean) {
    this._show = value;
    if (!value) {
      this.currentTab = 0
    }
  }
}
