import {Injectable} from '@angular/core';
import {ElectronService} from "..";

@Injectable({
  providedIn: 'root'
})
export class FileService {

  public APP_DATA_PATH = process.env['APPDATA'];

  constructor(private electron: ElectronService) {
  }

  // 根路径
  private _resolveBasePath(dir?: string) {
    return this.electron.path.resolve(this.APP_DATA_PATH, this.electron.ipcRenderer.sendSync('sync-get-app-name'), 'Report', dir || '.');
  }

  // 递归删除文件
  private _deleteFolder(path) {
    let files = [];
    if (this.electron.fs.existsSync(path)) {
      files = this.electron.fs.readdirSync(path);
      files.forEach((file) => {
        const curPath = path + "/" + file;
        if (this.electron.fs.statSync(curPath).isDirectory()) { // recurse
          this._deleteFolder(curPath);
        } else { // delete file
          this.electron.fs.unlinkSync(curPath);
        }
      });
      this.electron.fs.rmdirSync(path);
    }
  };

  // 创建文件夹
  mkdir(name) {
    return new Promise<string>(((resolve, reject) => {
      const path = this._resolveBasePath(name);
      this.electron.fs.mkdir(path, {recursive: true}, (err) => {
        if (!err) {
          resolve(path)
        } else {
          reject(err)
        }
      });
    }))
  }

  // 写入文件
  writeFile(path, name, buffer) {
    return new Promise(((resolve, reject) => {
      this.electron.fs.writeFile(path + this.electron.path.sep + name, buffer, function (err) {
        if (!err) {
          resolve()
        } else {
          reject(err)
        }
      })
    }))
  }

  // 清除生成文件
  cleanUp() {
    this._deleteFolder(this._resolveBasePath());
  }

  // 打包
  archive(path) {
    const zipArchiver = this.electron.archiver('zip');
    const folder = this._resolveBasePath();
    zipArchiver.directory(folder, false);
    const output = this.electron.fs.createWriteStream(path);
    zipArchiver.pipe(output);
    zipArchiver.finalize();
  }

}
