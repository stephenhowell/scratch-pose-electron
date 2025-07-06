const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  
  // This is needed for the intro page to get the IP address
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // This is needed for the "Start Posing" button to work
  startPosing: () => ipcRenderer.invoke('start-posing'),

  // Load the Scratch project
  getFileAsBuffer: (filePath) => ipcRenderer.invoke('get-file-as-buffer', filePath),

  // Methods to handle pose data and Kinect status
  onPoseData: (callback) => {
    ipcRenderer.on('pose-data', (event, data) => callback(data));
  },
  onKinectStatus: (callback) => {
    ipcRenderer.on('kinect-status', (event, data) => callback(data));
  },
  removePoseDataListener: () => {
    ipcRenderer.removeAllListeners('pose-data');
  },
  removeKinectStatusListener: () => {
    ipcRenderer.removeAllListeners('kinect-status');
  },
  
    // Android server methods
  android: {
    startServer: () => ipcRenderer.invoke('start-android-server'),
    onData: (callback) => {
      ipcRenderer.on('android-data', (event, dataString) => callback(event, dataString));
    },
    onConnectionStatus: (callback) => {
      ipcRenderer.on('android-connection-status', (event, status) => callback(event, status));
    },
    removeDataListener: () => {
      ipcRenderer.removeAllListeners('android-data');
    },
    removeStatusListener: () => {
      ipcRenderer.removeAllListeners('android-connection-status');
    }
  },
  
  // Utility methods
  isElectron: true,
  platform: process.platform
});

console.log('Preload script loaded!');