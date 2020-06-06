import {app, BrowserWindow, screen, Menu, dialog, ipcMain} from 'electron';
import {autoUpdater, CancellationToken} from 'electron-updater';
import * as path from 'path';
import * as url from 'url';
import * as os from 'os'

let win: BrowserWindow = null;
const args = process.argv.slice(1);
const serve = args.some(val => val === '--serve');


function createWindow(): BrowserWindow {
  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;
  // Create the browser window.
  win = new BrowserWindow({
    x: (size.width - 1024) / 2,
    y: (size.height - 768) / 2,
    width: 1024,
    height: 768,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: (serve) ? true : false,
    },
  });

  if (serve) {
    require('devtron').install();
    win.webContents.openDevTools();
    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`)
    });
    win.loadURL('http://localhost:4200');
  } else {
    win.loadURL(url.format({
      pathname: path.join(__dirname, 'dist/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  setupListener();
  setupUpdater();
  return win;
}

function setupListener() {
  ipcMain.on('sync-get-app-name', (event) => {
    event.returnValue = app.name;
  });
}

function setupUpdater() {
  // 不自动下载
  autoUpdater.autoDownload = false;
  let cancelToken = new CancellationToken();
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://electron-store.oss-cn-shenzhen.aliyuncs.com/ng-weekly-report-helper/'
  });
  autoUpdater.on('checking-for-update', function () {
    win.webContents.send('update-checking')
  });
  autoUpdater.on('error', function () {
    win.webContents.send('update-error')
  });
  autoUpdater.on('update-not-available', function () {
    win.webContents.send('update-not-available')
  });
  autoUpdater.on('update-available', function (info) {
    win.webContents.send('update-available', info)
  });
  autoUpdater.on('download-progress', function (progressObj) {
    win.webContents.send('update-download-progress', progressObj)
  });
  autoUpdater.on('update-downloaded', function () {
    win.webContents.send('update-downloaded')
  });
  ipcMain.on('start-update', () => autoUpdater.downloadUpdate(cancelToken));
  ipcMain.on('cancel-download', () => {
    cancelToken.cancel();
    cancelToken.dispose();
    cancelToken = new CancellationToken();
  });
  ipcMain.on('update-now', () => autoUpdater.quitAndInstall())
}

try {
  app.allowRendererProcessReuse = true;
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on('ready', () => {
    setTimeout(createWindow, 400);
    const name = app.name;
    let template = [
      {
        label: name,
        submenu: [
          {
            label: `设置`,
            role: 'about',
            click: function () {
              win.webContents.send('open-setting')
            }
          },
          {type: 'separator'},
          {
            label: '退出',
            accelerator: 'CmdOrCtrl+Q',
            role: 'close',
            click: function () {
              app.quit()
            }
          }
        ]
      },
      {
        label: '帮助',
        submenu: [
          {
            label: `检查更新`,
            role: 'check-update',
            click: function () {
              autoUpdater.checkForUpdates()
            }
          },
          {
            label: `关于`,
            role: 'about',
            click: function () {
              dialog.showMessageBox(win, {
                type: 'info',
                title: name,
                message: name,
                detail: `Version: ${app.getVersion()}\nAngular: 9.1.4\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode.js: ${process.versions.node}\nV8: ${process.versions.v8}\nOS: ${os.type()} ${os.arch()} ${os.release()}`
              })
            }
          }
        ]
      }
    ];
    let menu = Menu.buildFromTemplate(template as any);
    Menu.setApplicationMenu(menu)
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });

} catch (e) {
  // Catch Error
  // throw e;
}
