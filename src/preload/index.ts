import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../shared/api.js'
import { IpcChannels, type DownloadProgressPayload, type TopUpdatedPayload } from '../shared/ipc.js'

const api: AppApi = {
  ping: () => ipcRenderer.invoke(IpcChannels.ping),
  pollNow: () => ipcRenderer.invoke(IpcChannels.pollNow),
  pollerStatus: () => ipcRenderer.invoke(IpcChannels.pollerStatus),
  topMovies: (category) => ipcRenderer.invoke(IpcChannels.topMovies, category),
  listMovies: (arg) => ipcRenderer.invoke(IpcChannels.listMovies, arg),
  enrichNow: () => ipcRenderer.invoke(IpcChannels.enrichNow),
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IpcChannels.updateSettings, patch),
  download: (movieId) => ipcRenderer.invoke(IpcChannels.download, movieId),
  play: (movieId) => ipcRenderer.invoke(IpcChannels.play, movieId),
  setStatus: (movieId, status) => ipcRenderer.invoke(IpcChannels.setStatus, movieId, status),
  testQbit: () => ipcRenderer.invoke(IpcChannels.testQbit),
  openPath: (path) => ipcRenderer.invoke(IpcChannels.openPath, path),
  onTopUpdated: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: TopUpdatedPayload): void => cb(payload)
    ipcRenderer.on(IpcChannels.topUpdated, handler)
    return () => ipcRenderer.off(IpcChannels.topUpdated, handler)
  },
  onDownloadProgress: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: DownloadProgressPayload): void => cb(payload)
    ipcRenderer.on(IpcChannels.downloadProgress, handler)
    return () => ipcRenderer.off(IpcChannels.downloadProgress, handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
