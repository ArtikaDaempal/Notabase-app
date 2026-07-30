const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')

let mainWindow
let serverProcess = null

// Determine if we are running inside a packaged app (dist-desktop) or dev
const isPackaged = !process.defaultApp
// Base directory of the electron package (where Notabase.exe lives)
const appRoot = isPackaged ? path.join(process.resourcesPath, 'app') : __dirname

function waitForServer(url, retries, callback) {
  http.get(url, (res) => {
    if (res.statusCode === 200 || res.statusCode === 308 || res.statusCode === 307) {
      callback(null)
    } else {
      retry()
    }
  }).on('error', retry)

  function retry() {
    if (retries <= 0) {
      callback(new Error('Server did not start in time'))
      return
    }
    setTimeout(() => waitForServer(url, retries - 1, callback), 1000)
  }
}

function startNextServer(callback) {
  // Check if standalone server exists (built output)
  const standaloneServer = path.join(appRoot, '.next', 'standalone', 'server.js')
  const hasStandalone = fs.existsSync(standaloneServer)

  if (hasStandalone) {
    // Production: run the standalone Next.js server bundled with the app
    serverProcess = spawn(process.execPath, [standaloneServer], {
      cwd: path.join(appRoot, '.next', 'standalone'),
      env: {
        ...process.env,
        PORT: '3000',
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1',
      },
      stdio: 'pipe',
    })
    serverProcess.stdout.on('data', (d) => console.log('[Server]', d.toString()))
    serverProcess.stderr.on('data', (d) => console.error('[Server]', d.toString()))
    waitForServer('http://127.0.0.1:3000', 30, callback)
  } else {
    // Dev mode: assume `npm run dev` is already running externally
    callback(null)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 868,
    minWidth: 1024,
    minHeight: 700,
    title: 'Notabase Komdigi Manado',
    icon: path.join(appRoot, 'public', 'icons', 'icon-512x512.png'),
    autoHideMenuBar: true,
    backgroundColor: '#FFFFFF',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL('http://127.0.0.1:3000')

  // Open external links in default OS browser (OneDrive, etc.)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  startNextServer((err) => {
    if (err) {
      console.error('Failed to start server:', err)
    }
    createWindow()
  })
})

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
