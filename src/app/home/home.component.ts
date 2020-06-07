import {ChangeDetectorRef, Component, OnDestroy, OnInit,} from '@angular/core';
import {NzMessageService} from 'ng-zorro-antd/message';
import {UploadFile} from 'ng-zorro-antd/upload';
import {ElectronService, StoreService, NotificationService} from "../core/services";
import {Project} from "../core/model/project.model";
import {XlsxService} from "../core/services/xlsx/xlsx.service";
import {Analyzation} from "../core/model/analyzation.model";
import {NzModalService, NzNotificationService} from "ng-zorro-antd";

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
  releaseInfo: any;
  private _downloading = false;
  private _downloadProgress = 0;
  private _currentStep = 0;
  private _handing = false;
  private _settingModalVisible = false;
  private _updateModalVisible = false;


  constructor(private msg: NzMessageService, private xlsx: XlsxService, private electron: ElectronService, private message: NzMessageService,
              private notify: NzNotificationService, private cdr: ChangeDetectorRef, private notification: NotificationService,
              private modalService: NzModalService, private store: StoreService) {
  }

  ngOnInit(): void {
    this.setupListeners();
    this.currentProject = this.store.getProjectList().find(i => i.checked);
    this.notification.on('project-updated', project => {
      this.currentProject = project;
      if (!project) {
        this.currentStep = 0
      }
    })
  }

  ngOnDestroy(): void {
    this.removeListeners();
    this.notification.off('project-updated')
  }

  setupListeners() {
    this.electron.ipcRenderer.on('open-setting', (() => {
      this.settingModalVisible = true;
    }));
    this.electron.ipcRenderer.on('update-checking', () => {
      this.notify.remove();
      this.notify.info('正在检查更新...', '');
    });
    this.electron.ipcRenderer.on('update-error', () => {
      this.notify.remove();
      this.notify.error('更新出错', '');
      this.updateModalVisible = false;
      this.downloading = false;
    });
    this.electron.ipcRenderer.on('update-not-available', () => {
      this.notify.remove();
      this.notify.success('已经是最新版本', '');
    });
    this.electron.ipcRenderer.on('update-available', (e, info: any) => {
      this.notify.remove();
      info.releaseNotes = info.releaseNotes.replace(/\n/g, '<br>');
      info.releaseDate = new Date(info.releaseDate).toLocaleDateString();
      this.releaseInfo = info;
      this.updateModalVisible = true
    });
    this.electron.ipcRenderer.on('update-download-progress', (e, progress) => {
      this.downloadProgress = progress.percent;
    });
    this.electron.ipcRenderer.on('update-downloaded', () => {
      this.downloading = false;
      this.updateModalVisible = false;
      this.modalService.confirm({
        nzTitle: '更新确认',
        nzContent: '更新已下载完成，是否安装？',
        nzOnOk: () => this.electron.ipcRenderer.send('update-now')
      })
    });
  }

  removeListeners() {
    this.electron.ipcRenderer.removeAllListeners('open-setting');
    this.electron.ipcRenderer.removeAllListeners('update-checking');
    this.electron.ipcRenderer.removeAllListeners('update-error');
    this.electron.ipcRenderer.removeAllListeners('update-not-available');
    this.electron.ipcRenderer.removeAllListeners('update-available');
    this.electron.ipcRenderer.removeAllListeners('update-download-progress');
    this.electron.ipcRenderer.removeAllListeners('update-downloaded');
  }

  startUpdate() {
    this.electron.ipcRenderer.send('start-update');
    this.downloading = true
  }

  closeUpdateModal() {
    this.updateModalVisible = false;
    if (this.downloading) {
      this.electron.ipcRenderer.send('cancel-download');
      setTimeout(() => {
        this.downloading = false;
      }, 300)
    }
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
        this.message.remove();
        if (e === -1) {
          this.message.error('文件内容错误，请确认')
        } else if (e === -2) {
          this.message.error('存在未配置人员，请确认配置')
        } else {
          this.message.error(e.toString())
        }

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
    const month = this.analyzations.map(a => a.month).join(`、`);
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

  get settingModalVisible(): boolean {
    return this._settingModalVisible;
  }

  set settingModalVisible(value: boolean) {
    this._settingModalVisible = value;
    this.cdr.detectChanges();
  }


  get updateModalVisible(): boolean {
    return this._updateModalVisible;
  }

  set updateModalVisible(value: boolean) {
    this._updateModalVisible = value;
    this.cdr.detectChanges();
  }


  get downloading(): boolean {
    return this._downloading;
  }

  set downloading(value: boolean) {
    this._downloading = value;
    if (!this._downloading) {
      this.downloadProgress = 0;
    }
    this.cdr.detectChanges();
  }

  get downloadProgress(): number {
    return this._downloadProgress;
  }

  set downloadProgress(value: number) {
    this._downloadProgress = +value.toFixed(2);
    this.cdr.detectChanges();
  }
}
