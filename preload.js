const { contextBridge, ipcRenderer } = require('electron');

// SME-ERP IPC 브릿지 (T8)
// - window.api.sme.* 네임스페이스로만 노출. 구 채널(customers/educations/hrEmployees 등)은 폐기.
// - 응답 형식: 성공 {ok:true, data} / 실패 {ok:false, message} (메인 핸들러 보장).
// - print/app은 도메인 무관 셸 유틸리티로 유지 (Phase 3 인쇄/종료 버튼에서 사용).
const sme = {};
const CHANNELS = [
  'sme:auth:login', 'sme:auth:logout', 'sme:auth:checkSession',
  'sme:onboarding:getStatus', 'sme:onboarding:submit',
  'sme:dashboard:getSummary',
  'sme:partners:list', 'sme:partners:get', 'sme:partners:save', 'sme:partners:delete',
  'sme:invoices:list', 'sme:invoices:createBatch', 'sme:invoices:updateStatus',
  'sme:ledger:getPartnerLedger', 'sme:ledger:recordPayment',
  'sme:print:html',
  'sme:app:quit'
];

function nest(target, parts, leaf) {
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    node[parts[i]] = node[parts[i]] || {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = leaf;
}

for (const channel of CHANNELS) {
  const parts = channel.split(':').slice(1); // ['auth','login'] ...
  nest(sme, parts, (payload) => ipcRenderer.invoke(channel, payload));
}

contextBridge.exposeInMainWorld('api', { sme });
