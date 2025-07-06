const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

const isDev = process.argv.includes('--dev');
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1920, height: 1080,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.loadFile(path.join(__dirname, 'intro.html'));
    if (isDev) mainWindow.webContents.openDevTools();
}

ipcMain.handle('get-app-info', () => {
    const nets = os.networkInterfaces();
    let ipAddress = '127.0.0.1';
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                ipAddress = net.address;
                break;
            }
        }
        if (ipAddress !== '127.0.0.1') break;
    }
    return {
        version: app.getVersion(),
        name: app.getName(),
        ipAddress: ipAddress
    };
});

// The project loading is handled by the 'easy-scratch' prop method.
ipcMain.handle('start-posing', async () => {
    const scratchPath = isDev
        ? 'http://localhost:8601'
        : `file://${path.join(__dirname, '../scratch-forks/scratch-gui/build/index.html')}`;
    
    await mainWindow.loadURL(scratchPath);
    return { success: true };
});

ipcMain.handle('get-file-as-buffer', async (event, filePath) => {
    try {
        let absolutePath;
        if (app.isPackaged) {
            absolutePath = path.join(process.resourcesPath, filePath);
        } else {
            absolutePath = path.join(app.getAppPath(), 'src', filePath);
        }
        const data = await fs.readFile(absolutePath);
        return data;
    } catch (error) {
        console.error(`Failed to read file: ${filePath}`, error);
        return null;
    }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());