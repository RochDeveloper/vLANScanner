'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const { createPreloadApi } = require('./preload-api');

createPreloadApi({ contextBridge, ipcRenderer });
