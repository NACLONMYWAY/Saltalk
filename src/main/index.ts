import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { AppDatabase } from './db'
import { AppService } from './service'
import { registerIpc } from './ipc'
import { CONFIG_KEYS } from '../../shared/configKeys'

let db: AppDatabase
let service: AppService

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const dataDir = app.getPath('userData')
  const audioDir = join(dataDir, 'audio')
  db = new AppDatabase(join(dataDir, 'app.db'))

  // 记录当前版本号，但不做任何数据清理：
  // 新装时数据库本就是空的；升级时应保留用户数据（单词本/历史/API key）
  db.setConfig(CONFIG_KEYS.appVersion, app.getVersion())

  service = new AppService(db, audioDir)
  registerIpc(db, service)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export function getDb(): AppDatabase {
  return db
}

export function getService(): AppService {
  return service
}
