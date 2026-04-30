import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../shared/api.js'
import { IpcChannels, type TopUpdatedPayload } from '../shared/ipc.js'

const api: AppApi = {
  ping: () => ipcRenderer.invoke(IpcChannels.ping),
  pollNow: () => ipcRenderer.invoke(IpcChannels.pollNow),
  pollerStatus: () => ipcRenderer.invoke(IpcChannels.pollerStatus),
  topMovies: (category) => ipcRenderer.invoke(IpcChannels.topMovies, category),
  enrichNow: () => ipcRenderer.invoke(IpcChannels.enrichNow),
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IpcChannels.updateSettings, patch),
  onTopUpdated: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: TopUpdatedPayload): void => cb(payload)
    ipcRenderer.on(IpcChannels.topUpdated, handler)
    return () => ipcRenderer.off(IpcChannels.topUpdated, handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
