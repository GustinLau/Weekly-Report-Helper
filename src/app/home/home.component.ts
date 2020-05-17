import {ChangeDetectorRef, Component, OnDestroy, OnInit,} from '@angular/core';
import {NzMessageService} from 'ng-zorro-antd/message';
import {UploadFile} from 'ng-zorro-antd/upload';
import {ElectronService, StoreService, NotificationService} from "../core/services";
import {Project} from "../core/model/project.model";
import {XlsxService} from "../core/services/xlsx/xlsx.service";
import {Analyzation} from "../core/model/analyzation.model";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  uploadStatus = 'process';
  settingStatus = 'wait';
  finishStatus = 'wait';
  currentProject?: Project;
  analyzations: Analyzation[];
  private _currentStep = 0;
  private _handing = false;
  private _modalVisible = false;


  constructor(private msg: NzMessageService, private xlsx: XlsxService, private electron: ElectronService, private message: NzMessageService,
              private cdr: ChangeDetectorRef, private notification: NotificationService, private store: StoreService) {
  }

  ngOnInit(): void {
    this.electron.ipcRenderer.on('open-setting', (() => {
      this.modalVisible = true;
    }));
    this.currentProject = this.store.getProjectList().find(i => i.checked);
    this.notification.on('project-updated', project => {
      this.currentProject = project;
      if (!project) {
        this.currentStep = 0
      }
    })
  }

  ngOnDestroy(): void {
    this.electron.ipcRenderer.removeAllListeners('open-setting');
    this.notification.off('project-updated')
  }

  // 步骤选择
  handleStepChange(index) {
    this.currentStep = index
  }

  // 处理上传的文件
  handleFile(file: UploadFile) {
    this.xlsx.analyse(file)
      .then(analyzations => {
        this.analyzations = analyzations;
        this.currentStep = 1;
      })
      .catch((e) => {
        console.error(e)
        this.message.remove();
        this.message.error(e === -1 ? '文件内容错误，请确认' : e.toString())
      });
    return false;
  }

  // 导出数据
  exportData() {
    this.handing = true;
    const data = this.xlsx.handleAnalyzations(this.currentProject, this.analyzations);
    this.xlsx.writeFile(this.currentProject, data)
      .then(() => {
        this.handing = false;
        this.currentStep = 2;
        setTimeout(() => {
          this.exportArchivedFile()
        }, 100)
      })
      .catch(e => {
        this.handing = false;
        this.electron.remote.dialog.showErrorBox('导出失败', e.toString());
      });
  }

  exportArchivedFile() {
    const month = this.analyzations.map(a => a.month).join(`、`)
    this.electron.remote.dialog.showSaveDialog(this.electron.remote.getCurrentWindow(), {
      defaultPath: `${this.currentProject.id}-${this.currentProject.name}周报（${month}）.zip`
    }).then(result => {
      if (result.filePath) {
        this.xlsx.saveArchiveFile(result.filePath);
      }
    })
  }

  get currentStep(): number {
    return this._currentStep;
  }

  set currentStep(value: number) {
    this._currentStep = value;
    switch (value) {
      case 0: {
        this.uploadStatus = 'process';
        this.settingStatus = 'wait';
        this.finishStatus = 'wait';
        break;
      }
      case 1: {
        this.uploadStatus = 'finish';
        this.settingStatus = 'process';
        this.finishStatus = 'wait';
        break;
      }
      case 2: {
        this.uploadStatus = 'finish';
        this.settingStatus = 'finish';
        this.finishStatus = 'process';
      }
    }
  }

  get handing(): boolean {
    return this._handing;
  }

  set handing(value: boolean) {
    this._handing = value;
    if (this._currentStep === 2 && !this._handing) {
      this.finishStatus = 'finish'
    }
  }

  get modalVisible(): boolean {
    return this._modalVisible;
  }

  set modalVisible(value: boolean) {
    this._modalVisible = value;
    this.cdr.detectChanges();
  }
}
