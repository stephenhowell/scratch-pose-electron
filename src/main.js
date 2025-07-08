const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

// Import WebSocket for handling pose data communication
const WebSocket = require('ws');

const isDev = process.argv.includes('--dev');
let mainWindow;

// Pose data server and clients
let poseDataServer = null;
let currentPoseClient = null;

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
    const candidates = {};

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // We are only interested in IPv4 addresses and we want to skip internal ones
            if (net.family === 'IPv4' && !net.internal) {
                // Store the IP address with its interface name
                if (!candidates[name]) {
                    candidates[name] = [];
                }
                candidates[name].push(net.address);
            }
        }
    }

    // --- Prioritization Logic ---
    let ipAddress = '';

    // 1. Look for a WiFi adapter first, as it's the most common for this use case.
    const wifiInterface = Object.keys(candidates).find(name => name.toLowerCase().includes('wifi'));
    if (wifiInterface) {
        ipAddress = candidates[wifiInterface][0];
    }

    // 2. If no WiFi, look for an Ethernet adapter.
    if (!ipAddress) {
        const ethernetInterface = Object.keys(candidates).find(name => name.toLowerCase().includes('ethernet'));
        if (ethernetInterface) {
            ipAddress = candidates[ethernetInterface][0];
        }
    }
    
    // 3. As a last resort, take the first available IP that isn't the virtual switch.
    if (!ipAddress) {
        const firstAvailable = Object.keys(candidates).find(name => !name.toLowerCase().includes('vethernet'));
        if(firstAvailable) {
            ipAddress = candidates[firstAvailable][0];
        } else {
            ipAddress = '127.0.0.1'; // Fallback
        }
    }

    return {
        version: app.getVersion(),
        name: app.getName(),
        ipAddress: ipAddress // This will now be the prioritized IP
    };
});

// The project loading is handled by the 'easy-scratch' prop method.
ipcMain.handle('start-posing', async () => {
    const scratchPath = isDev
        ? 'http://localhost:8601'
        : `file://${path.join(__dirname, '../scratch-forks/scratch-gui/build/index.html')}`;
    
    await mainWindow.loadURL(scratchPath);

    // After the GUI has loaded, inject the API
    mainWindow.webContents.once('dom-ready', async () => {
        console.log('[Main Process] DOM is ready. Attempting to inject API into VM runtime...');
        
        await mainWindow.webContents.executeJavaScript(`
            // This script polls until both the VM and the API are ready
            const installApiWhenReady = () => {
                if (window.vm && window.electronAPI) {            
                    console.log('✅ VM and electronAPI found. Injecting API into vm.runtime...');
                    window.vm.runtime.electronAPI = window.electronAPI;
                } else {
                    // If not ready, check again on the next frame
                    requestAnimationFrame(installApiWhenReady);
                }
            };
            installApiWhenReady();
        `);
    });

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

// Handle the stop-pose-client request to close the current WebSocket client connection
ipcMain.handle('stop-pose-client', () => {
    if (currentPoseClient) {
        console.log('[Main Process] Closing active client connection via block.');
        currentPoseClient.close();
        currentPoseClient = null;
        return { success: true, message: 'Client connection stopped.' };
    }
    return { success: true, message: 'No active client to stop.' };
});

ipcMain.handle('start-pose-server', async () => {
    if (poseDataServer) {
        console.log('[Main Process] Pose data server is already running.');
        return { success: true, message: 'Server already running.' };
    }

    try {
        poseDataServer = new WebSocket.Server({ port: 8183 });

        poseDataServer.on('listening', () => {
            console.log('[Main Process] Pose data WebSocket server started on port 8183.');
        });

        poseDataServer.on('connection', (ws) => {
            // If there's an existing client, disconnect it first.
            if (currentPoseClient) {
                console.log('[Main Process] New client connected. Closing existing connection.');
                currentPoseClient.close(1000, 'New connection established');
            }

            // Set the new connection as the current one.
            currentPoseClient = ws;
            console.log('[Main Process] New client is now active.');

            // Send a status update to the GUI
            mainWindow.webContents.send('pose-connection-status', { connected: true, count: 1 });

            // Notify the GUI that a client has connected. This unblocks the "wait" block.
            mainWindow.webContents.send('pose-client-connected');

            ws.on('message', (data) => {
                // Forward pose data to the renderer
                // console.log('[Main Process] Received pose data from client...'); //, data.toString());	
                mainWindow.webContents.send('pose-data-received', data.toString());
            });

            ws.on('close', () => {
                console.log('[Main Process] Active client disconnected.');
                // If the client that disconnected is the one we were tracking, clear it.
                if (ws === currentPoseClient) {
                    currentPoseClient = null;
                    // Send an updated status when the client disconnects
                    mainWindow.webContents.send('pose-connection-status', { connected: false, count: 0 });
                }
            });

            ws.on('error', (error) => {
                console.error('[Main Process] WebSocket client error:', error);
            });
        });

        return { success: true, message: 'Server started.' };

    } catch (error) {
        console.error('[Main Process] Failed to start pose data server:', error);
        return { success: false, message: error.message };
    }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());