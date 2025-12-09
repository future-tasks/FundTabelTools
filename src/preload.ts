// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openFileDialog: () => ipcRenderer.invoke("dialog:openFile"),
  getUserDataPath: () => ipcRenderer.invoke("app:getUserDataPath"),
  readFile: (filePath: string) => ipcRenderer.invoke("file:readFile", filePath),
  writeFile: (filePath: string, data: string) =>
    ipcRenderer.invoke("file:writeFile", filePath, data),
  fileExists: (filePath: string) =>
    ipcRenderer.invoke("file:fileExists", filePath),
});
