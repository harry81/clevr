const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (payload) => ipcRenderer.invoke('login', payload),
  customers: {
    list: (payload) => ipcRenderer.invoke('customers:list', payload),
    save: (payload) => ipcRenderer.invoke('customers:save', payload),
    delete: (payload) => ipcRenderer.invoke('customers:delete', payload)
  },
  invoices: {
    list: (payload) => ipcRenderer.invoke('invoices:list', payload),
    save: (payload) => ipcRenderer.invoke('invoices:save', payload),
    delete: (payload) => ipcRenderer.invoke('invoices:delete', payload)
  },
  companyInfo: {
    get: (payload) => ipcRenderer.invoke('companyInfo:get', payload),
    save: (payload) => ipcRenderer.invoke('companyInfo:save', payload)
  },
  payments: {
    list: (payload) => ipcRenderer.invoke('payments:list', payload),
    save: (payload) => ipcRenderer.invoke('payments:save', payload),
    delete: (payload) => ipcRenderer.invoke('payments:delete', payload)
  },
  educations: {
    list: (payload) => ipcRenderer.invoke('educations:list', payload),
    save: (payload) => ipcRenderer.invoke('educations:save', payload),
    delete: (payload) => ipcRenderer.invoke('educations:delete', payload)
  },
  trainees: {
    list: (payload) => ipcRenderer.invoke('trainees:list', payload),
    save: (payload) => ipcRenderer.invoke('trainees:save', payload),
    delete: (payload) => ipcRenderer.invoke('trainees:delete', payload)
  },
  users: {
    list: (payload) => ipcRenderer.invoke('users:list', payload),
    save: (payload) => ipcRenderer.invoke('users:save', payload),
    delete: (payload) => ipcRenderer.invoke('users:delete', payload)
  },
  taxDocs: {
    list: (payload) => ipcRenderer.invoke('taxDocs:list', payload),
    save: (payload) => ipcRenderer.invoke('taxDocs:save', payload),
    delete: (payload) => ipcRenderer.invoke('taxDocs:delete', payload)
  },
  commonCodes: {
    list: (payload) => ipcRenderer.invoke('commonCodes:list', payload),
    save: (payload) => ipcRenderer.invoke('commonCodes:save', payload),
    delete: (payload) => ipcRenderer.invoke('commonCodes:delete', payload)
  },
  hrEmployees: {
    list: (payload) => ipcRenderer.invoke('hrEmployees:list', payload),
    save: (payload) => ipcRenderer.invoke('hrEmployees:save', payload),
    delete: (payload) => ipcRenderer.invoke('hrEmployees:delete', payload)
  },
  codeGroupMeta: {
    list: (payload) => ipcRenderer.invoke('codeGroupMeta:list', payload),
    save: (payload) => ipcRenderer.invoke('codeGroupMeta:save', payload)
  },
  eduUploadEntries: {
    list: (payload) => ipcRenderer.invoke('eduUploadEntries:list', payload),
    save: (payload) => ipcRenderer.invoke('eduUploadEntries:save', payload),
    delete: (payload) => ipcRenderer.invoke('eduUploadEntries:delete', payload)
  },
  eduConfirmDocs: {
    list: (payload) => ipcRenderer.invoke('eduConfirmDocs:list', payload),
    save: (payload) => ipcRenderer.invoke('eduConfirmDocs:save', payload),
    delete: (payload) => ipcRenderer.invoke('eduConfirmDocs:delete', payload)
  },
  programs: {
    list: (payload) => ipcRenderer.invoke('programs:list', payload),
    save: (payload) => ipcRenderer.invoke('programs:save', payload),
    delete: (payload) => ipcRenderer.invoke('programs:delete', payload)
  },
  programPermissions: {
    list: (payload) => ipcRenderer.invoke('programPermissions:list', payload),
    save: (payload) => ipcRenderer.invoke('programPermissions:save', payload),
    delete: (payload) => ipcRenderer.invoke('programPermissions:delete', payload)
  },
  groupPermissions: {
    list: (payload) => ipcRenderer.invoke('groupPermissions:list', payload),
    save: (payload) => ipcRenderer.invoke('groupPermissions:save', payload),
    delete: (payload) => ipcRenderer.invoke('groupPermissions:delete', payload)
  },
  app: {
    quit: () => ipcRenderer.invoke('app:quit')
  },
  onboarding: {
    get: () => ipcRenderer.invoke('onboarding:get'),
    set: (payload) => ipcRenderer.invoke('onboarding:set', payload)
  },
  print: {
    html: (payload) => ipcRenderer.invoke('print:html', payload)
  },
  excel: {
    parseFile: (payload) => ipcRenderer.invoke('excel:parseFile', payload)
  }
});
