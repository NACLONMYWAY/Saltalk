import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { AppDatabase } from './db'
import { AppService } from './service'
import { registerIpc } from './ipc'

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

  // 版本变化时彻底重置所有数据（含 API key），保证新装后干净
  const currentVersion = app.getVersion()
  if (db.getConfig('app_version') !== currentVersion) {
    db.clearEverything()
    db.setConfig('app_version', currentVersion)
  }

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
