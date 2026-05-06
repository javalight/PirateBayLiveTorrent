import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../shared/api.js'
import { IpcChannels, type DownloadProgressPayload, type TopUpdatedPayload } from '../shared/ipc.js'

const api: AppApi = {
  ping: () => ipcRenderer.invoke(IpcChannels.ping),
  pollNow: () => ipcRenderer.invoke(IpcChannels.pollNow),
  pollOneNow: (topicId) => ipcRenderer.invoke(IpcChannels.pollOneNow, topicId),
  pollerStatus: () => ipcRenderer.invoke(IpcChannels.pollerStatus),
  listTopics: () => ipcRenderer.invoke(IpcChannels.listTopics),
  createTopic: (arg) => ipcRenderer.invoke(IpcChannels.createTopic, arg),
  updateTopic: (topicId, patch) => ipcRenderer.invoke(IpcChannels.updateTopic, topicId, patch),
  archiveTopic: (topicId) => ipcRenderer.invoke(IpcChannels.archiveTopic, topicId),
  topicStats: () => ipcRenderer.invoke(IpcChannels.topicStats),
  topMovies: (topicId) => ipcRenderer.invoke(IpcChannels.topMovies, topicId),
  listMovies: (arg) => ipcRenderer.invoke(IpcChannels.listMovies, arg),
  enrichMovie: (movieId) => ipcRenderer.invoke(IpcChannels.enrichMovie, movieId),
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IpcChannels.updateSettings, patch),
  download: (movieId) => ipcRenderer.invoke(IpcChannels.download, movieId),
  restartDownload: (movieId) => ipcRenderer.invoke(IpcChannels.restartDownload, movieId),
  cancelDownload: (movieId) => ipcRenderer.invoke(IpcChannels.cancelDownload, movieId),
  deleteFile: (movieId) => ipcRenderer.invoke(IpcChannels.deleteFile, movieId),
  findTorrents: (query, category) => ipcRenderer.invoke(IpcChannels.findTorrents, query, category),
  play: (movieId) => ipcRenderer.invoke(IpcChannels.play, movieId),
  setStatus: (movieId, status) => ipcRenderer.invoke(IpcChannels.setStatus, movieId, status),
  setFavorite: (movieId, favorite) => ipcRenderer.invoke(IpcChannels.setFavorite, movieId, favorite),
  openPath: (path) => ipcRenderer.invoke(IpcChannels.openPath, path),
  openExternal: (url) => ipcRenderer.invoke(IpcChannels.openExternal, url),
  openTrailer: (url, title) => ipcRenderer.invoke(IpcChannels.openTrailer, url, title),
  revealItem: (movieId) => ipcRenderer.invoke(IpcChannels.revealItem, movieId),
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
