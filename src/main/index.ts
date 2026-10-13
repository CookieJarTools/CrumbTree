import { app, BrowserWindow, Menu, nativeImage, shell } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { EVENTS } from '@shared/ipc-contract'
import { registerIpc } from './ipc'
import { getWindowBounds, setWindowBounds } from './store'

/**
 * App icon. Packaged builds get it baked into the .exe via electron-builder, but
 * the BrowserWindow (taskbar / Alt-Tab) and dev runs still need it set explicitly.
 * Resolved from resourcesPath when packaged, and the project root in dev.
 */
function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources', 'icon.png')
    : join(app.getAppPath(), 'resources', 'icon.png')
}

let mainWindow: BrowserWindow | null = null
let pendingDeeplink: string | null = null

// Register crumbtree:// so other apps can open a repo: crumbtree://open?path=<enc>
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient('crumbtree', process.execPath, [join(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient('crumbtree')
}

/** Pull a repo path out of argv (a bare directory) or a crumbtree:// URL. */
function extractTarget(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith('crumbtree://')) {
      try {
        const url = new URL(arg)
        const p = url.searchParams.get('path')
        if (p) return decodeURIComponent(p)
        // crumbtree://open/<path>
        const rest = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
        if (rest) return rest
      } catch {
        /* ignore malformed */
      }
    } else if (isRepoDir(arg)) {
      // Only accept a bare path arg if it's actually a git repo — avoids treating
      // dev-server argv noise (e.g. ".") as a repo and erroring on startup.
      return arg
    }
  }
  return null
}

function isRepoDir(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isDirectory() && existsSync(join(p, '.git'))
  } catch {
    return false
  }
}

/** Deliver a deep-link target to the renderer, queuing until the page is ready. */
function deliverDeeplink(target: string | null): void {
  if (!target) return
  const wc = mainWindow?.webContents
  if (wc && !wc.isLoading()) wc.send(EVENTS.deeplinkOpen, target)
  else pendingDeeplink = target
}

function createWindow(): void {
  const bounds = getWindowBounds()
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 940,
    minHeight: 600,
    show: false,
    frame: false,
    icon: nativeImage.createFromPath(iconPath()),
    backgroundColor: '#090c0d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingDeeplink) {
      mainWindow?.webContents.send(EVENTS.deeplinkOpen, pendingDeeplink)
      pendingDeeplink = null
    }
  })

  // Tell the renderer when the maximize state changes so the title-bar icon can update.
  const sendMax = () => mainWindow?.webContents.send(EVENTS.maximizeChanged, mainWindow.isMaximized())
  mainWindow.on('maximize', sendMax)
  mainWindow.on('unmaximize', sendMax)

  mainWindow.on('close', () => {
    if (mainWindow) {
      const b = mainWindow.getBounds()
      setWindowBounds({ width: b.width, height: b.height, x: b.x, y: b.y })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in the OS browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  // A second launch (e.g. from another app) forwards its argv here.
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    deliverDeeplink(extractTarget(argv))
  })

  // macOS protocol activation.
  app.on('open-url', (_e, url) => deliverDeeplink(extractTarget([url])))

  app.whenReady().then(() => {
    // Windows uses this to group taskbar items and pick the icon shown there.
    if (process.platform === 'win32') app.setAppUserModelId('com.crumbtree.app')
    Menu.setApplicationMenu(null) // frameless: no native menu bar
    registerIpc(() => mainWindow)
    createWindow()
    // Honour a target passed on the very first launch.
    pendingDeeplink = extractTarget(process.argv.slice(1))

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
