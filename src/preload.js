const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  
  // get the IP address
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),  
  // the "Start Posing" button (in the HTML page)
  startPosing: () => ipcRenderer.invoke('start-posing'),
  
  // Load the Scratch project
  getFileAsBuffer: (filePath) => ipcRenderer.invoke('get-file-as-buffer', filePath),

  // Kinect functionality
  onKinectStatus: (callback) => {
    ipcRenderer.on('kinect-status', (event, data) => callback(data));
  },  
  removeKinectStatusListener: () => {
    ipcRenderer.removeAllListeners('kinect-status');
  },
  
  // Asks the main process to start the WebSocket server.  
  startPoseServer: () => ipcRenderer.invoke('start-pose-server'),
  
  // Asks the main process to stop the WebSocket server.
  stopPoseClient: () => ipcRenderer.invoke('stop-pose-client'),
  
  /**
   * Sets up a one-time listener that fires when a phone connects.
   * This is used by the "and wait" block to resolve its Promise.
   */
  onPoseClientConnected: (callback) => {
    ipcRenderer.once('pose-client-connected', () => callback());
  },

  // Sets up a listener that receives all incoming pose data from the phone.  
  onPoseData: (callback) => {
    ipcRenderer.on('pose-data-received', (event, data) => callback(data));
  },
  
  // Sets up a listener that receives connection status updates.
  onPoseConnectionStatus: (callback) => {
    ipcRenderer.on('pose-connection-status', (event, status) => callback(status));
  },
  
  // Utility methods
  isElectron: true,
  platform: process.platform
});