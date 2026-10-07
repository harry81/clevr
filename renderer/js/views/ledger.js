/* 입금 등록 & 납부 명세서(화면 ④) — FIFO 즉시 충당 + A4 명세서 인쇄 */

// 제품 내장형 바이럴: 인쇄물 하단 1줄 마이크로 푸터 (외부 lib 0, 순수 문자열)
function watermarkFooter() {
  return '<p class="sme-print-footer">본 문서는 1인 사업자를 위한 100% 무료·회원가입 없는 청구도우미로 작성되었습니다 · 데이터는 내 PC에만 저장됩니다 · 무료 다운로드: https://github.com/harry81/clevr/releases/latest</p>';
}

function printDoc(view) {
  const App = window.App;
  const { partner, summary, entries } = view;
  const rows = entries.map((en) => `<tr><td>${App.esc(en.entryDate || '')}</td>
    <td>${en.entryType === '입금' ? '입금' : '매출청구'}</td>
    <td style="text-align:right">${App.won(en.supplyAmount)}</td>
    <td style="text-align:right">${App.won(en.vatAmount)}</td>
    <td style="text-align:right">${App.won(en.paidAmount)}</td>
    <td style="text-align:right"><strong>${App.won(en.runningBalance)}</strong></td>
    <td>${App.esc(en.invoiceNo || en.method || en.memo || '')}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
    <style>body{font-family:"Malgun Gothic",sans-serif;font-size:12px;color:#111}
    h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:5px 7px}
    th{background:#eee}.sum{margin:10px 0;font-size:14px}
    .sme-print-footer{margin-top:10px;font-size:10px;color:#666;text-align:right}</style></head><body>
    <h1>납부 명세서 / 영수증</h1>
    <p>${App.esc(partner.partnerName)} ${App.esc(partner.bizNo || '')} · 출력일 ${App.todayStr()}</p>
    <p class="sum">총 청구 ${App.won(summary.billedTotal)} · 총 입금 ${App.won(summary.paidTotal)} · <strong>미수잔액 ${App.won(summary.outstanding)}</strong></p>
    <table><thead><tr><th>일자</th><th>구분</th><th>공급가액</th><th>부가세</th><th>입금액</th><th>남은 미납액</th><th>비고</th></tr></thead>
    <tbody>${rows}</tbody></table>${watermarkFooter()}</body></html>`;
}

// T11 카톡 전송용 이미지 — 지정 6필드만 추출(순수).
function extractReceiptFields(view) {
  const partner = (view && view.partner) || {};
  const summary = (view && view.summary) || {};
  const entries = view && Array.isArray(view.entries) ? view.entries : [];
  const last = entries.length ? entries[entries.length - 1] : null;
  return {
    partnerName: partner.partnerName || '',
    ceoName: partner.ceoName || '',
    date: (last && last.entryDate) || '',
    supplyAmount: summary.billedTotal || 0,
    paidAmount: summary.paidTotal || 0,
    balance: summary.outstanding || 0,
  };
}

// 데이터URL allowlist: PNG base64만 허용 (main 프로세스와 동일 규칙, 방어적 사전 검증)
const IMAGE_DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
function isAllowedImageDataUrl(dataUrl) {
  return typeof dataUrl === 'string' && IMAGE_DATA_URL_RE.test(dataUrl);
}

// canvas 2D 수동 렌더 (외부 lib 0)
function buildReceiptImage(fields) {
  const W = 640;
  const H = 420;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px "Malgun Gothic", sans-serif';
  ctx.fillText('납부 명세서 요약', 32, 56);
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(32, 76);
  ctx.lineTo(W - 32, 76);
  ctx.stroke();

  const rows = [
    ['상호명', fields.partnerName || ''],
    ['대표자', fields.ceoName || '-'],
    ['거래일자', fields.date || '-'],
    ['공급가액', window.App.won(fields.supplyAmount)],
    ['입금액', window.App.won(fields.paidAmount)],
    ['남은 미납액', window.App.won(fields.balance)],
  ];
  let y = 130;
  for (const [label, value] of rows) {
    ctx.fillStyle = '#64748b';
    ctx.font = '18px "Malgun Gothic", sans-serif';
    ctx.fillText(label, 40, y);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px "Malgun Gothic", sans-serif';
    ctx.fillText(String(value), 220, y);
    y += 44;
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px "Malgun Gothic", sans-serif';
  ctx.fillText('청구도우미 · 1인 사업자를 위한 100% 무료', 40, H - 28);
  return canvas.toDataURL('image/png');
}

window.App.views.ledger = {
  title: '입금 / 납부 명세서',
  printDoc,
  extractReceiptFields,
  isAllowedImageDataUrl,
  buildReceiptImage,
  async render(root, params) {
    const App = window.App;
    const companyId = App.state.companyId;
    let partners = [];
    let selectedId = (params && params.partnerId) || null;
    let keyword = '';

    async function loadPartners() {
      partners = await App.call('partners', 'list', { companyId, keyword });
      if (!selectedId || !partners.some((p) => p.id === selectedId)) {
        selectedId = partners.length ? partners[0].id : null;
      }
    }

    async function draw() {
      try {
        await loadPartners();
      } catch (e) {
        root.innerHTML = `<p class="sme-error">${App.esc(e.message)}</p>`;
        return;
      }
      root.innerHTML = `
        <div class="sme-split">
          <div class="sme-panel">
            <div class="sme-toolbar"><input id="led-search" placeholder="거래처 검색" value="${App.esc(keyword)}"></div>
            <ul class="sme-plist">
              ${partners.map((p) => `<li data-pid="${App.esc(p.id)}" class="${p.id === selectedId ? 'active' : ''}">
                <div class="p-name">${App.esc(p.partnerName)}</div>
                <div class="p-sub">청구 ${App.won(p.billedAmount || 0)} · 입금 ${App.won(p.paidAmount || 0)}</div>
                <div class="p-bal">미수 ${App.won(p.outstandingBalance || 0)}</div></li>`).join('') || '<p class="sme-empty">거래처가 없습니다.</p>'}
            </ul>
          </div>
          <div class="sme-panel" id="led-right"><p class="sme-empty">불러오는 중…</p></div>
        </div>`;

      const search = root.querySelector('#led-search');
      search.addEventListener('input', () => {
        clearTimeout(search._t);
        search._t = setTimeout(() => { keyword = search.value.trim(); draw(); }, 250);
      });
      root.querySelectorAll('[data-pid]').forEach((li) => li.addEventListener('click', () => {
        selectedId = li.dataset.pid;
        root.querySelectorAll('[data-pid]').forEach((x) => x.classList.toggle('active', x === li));
        drawRight();
      }));
      await drawRight();
    }

    async function drawRight() {
      const box = root.querySelector('#led-right');
      if (!selectedId) { box.innerHTML = '<p class="sme-empty">거래처를 선택하세요.</p>'; return; }
      let view;
      try {
        view = await App.call('ledger', 'getPartnerLedger', { companyId, partnerId: selectedId });
      } catch (e) {
        box.innerHTML = `<p class="sme-error">${App.esc(e.message)}</p>`;
        return;
      }
      const { partner, summary, entries } = view;
      box.innerHTML = `
        <div class="sme-ledger-head">
          <strong>${App.esc(partner.partnerName)}</strong>
          <span class="sme-sub" style="margin:0">${App.esc(partner.bizNo || '')}</span>
          <span style="margin-left:auto">미수잔액 <span class="big">${App.won(summary.outstanding)}</span></span>
        </div>
        <div class="sme-sub">총 청구 ${App.won(summary.billedTotal)} · 총 입금 ${App.won(summary.paidTotal)}</div>
        <form class="sme-form" id="pay-form">
          <div><label>입금일자</label><input type="date" id="pay-date" value="${App.todayStr()}" required></div>
          <div><label>입금액</label><input id="pay-amount" inputmode="numeric" placeholder="0" required></div>
          <div><label>결제수단</label><select id="pay-method"><option>계좌이체</option><option>어음</option><option>카드</option></select></div>
          <div><label>메모</label><input id="pay-memo" placeholder="선택"></div>
        </form>
        <div class="sme-toolbar">
          <button class="sme-btn" id="pay-go">입금 반영</button>
          <button class="sme-btn ghost" id="led-print">명세서 인쇄(A4)</button>
          <button class="sme-btn ghost" id="led-share" ${entries.length ? '' : 'disabled'}>카톡 전송용 이미지 복사</button>
          <span class="sme-error" id="pay-error" style="margin:0"></span>
        </div>
        <table class="sme-table"><thead><tr><th>일자</th><th>구분</th><th class="num">공급가액</th>
          <th class="num">부가세</th><th class="num">입금액</th><th class="num">남은 미납액</th><th>비고</th></tr></thead><tbody>
        ${entries.map((en) => `<tr><td>${App.esc(en.entryDate || '')}</td>
          <td>${en.entryType === '입금' ? '입금' : '매출청구'}</td>
          <td class="num">${App.won(en.supplyAmount)}</td><td class="num">${App.won(en.vatAmount)}</td>
          <td class="num">${App.won(en.paidAmount)}</td><td class="num"><strong>${App.won(en.runningBalance)}</strong></td>
          <td>${App.esc(en.invoiceNo || en.method || en.memo || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="sme-empty">거래 내역이 없습니다.</td></tr>'}
        </tbody></table>`;

      box.querySelector('#pay-go').addEventListener('click', async () => {
        const err = box.querySelector('#pay-error');
        err.textContent = '';
        const amount = Number(box.querySelector('#pay-amount').value.replace(/[^0-9]/g, '') || 0);
        try {
          const r = await App.call('ledger', 'recordPayment', {
            companyId, partnerId: selectedId,
            paymentDate: box.querySelector('#pay-date').value,
            amount,
            method: box.querySelector('#pay-method').value,
            memo: box.querySelector('#pay-memo').value.trim()
          });
          const hit = (r.allocations || []).map((a) => `${a.invoiceNo} ${App.won(a.allocated)}`).join(', ');
          App.toast(`입금 반영 — 미수 ${App.won(r.outstanding)}${hit ? ` (${hit})` : ''}`, 'ok');
          draw();
        } catch (e) {
          err.textContent = e.message;
        }
      });
      box.querySelector('#led-print').addEventListener('click', async () => {
        try {
          const { path } = await App.call('print', 'html', { html: printDoc(view), fileName: `납부명세서_${partner.partnerName}` });
          App.toast(`명세서 PDF 저장: ${path}`, 'ok');
        } catch (e) {
          App.toast(e.message, 'error');
        }
      });
      box.querySelector('#led-share').addEventListener('click', async () => {
        try {
          const dataUrl = buildReceiptImage(extractReceiptFields(view));
          if (!isAllowedImageDataUrl(dataUrl)) throw new Error('이미지 데이터가 올바르지 않습니다');
          await App.call('clipboard', 'copyImage', { dataUrl });
          App.toast('카톡 전송용 이미지가 복사되었습니다.', 'ok');
        } catch (e) {
          App.toast(e.message, 'error');
        }
      });
    }

    await draw();
  }
};
