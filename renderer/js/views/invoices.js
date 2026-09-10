/* 청구서 일괄등록(화면 ③) — 프리뷰 모달 → 원클릭 일괄 생성 */
window.App.views.invoices = {
  title: '매출 청구서',
  async render(root, params) {
    const App = window.App;
    const companyId = App.state.companyId;
    let billingMonth = (params && params.billingMonth) || App.monthStr();
    const vatOf = (s) => Math.trunc(s * 0.1);

    async function draw() {
      let list = [];
      try {
        list = await App.call('invoices', 'list', { companyId, billingMonth });
      } catch (e) {
        root.innerHTML = `<p class="sme-error">${App.esc(e.message)}</p>`;
        return;
      }
      const supplySum = list.reduce((s, i) => s + i.supplyAmount, 0);
      const vatSum = list.reduce((s, i) => s + i.vatAmount, 0);
      const totalSum = list.reduce((s, i) => s + i.totalAmount, 0);

      root.innerHTML = `
        <div class="sme-toolbar">
          <input type="month" id="inv-month" value="${App.esc(billingMonth)}">
          <button class="sme-btn" id="inv-batch">월 일괄 청구서 생성</button>
        </div>
        <div class="sme-panel" style="margin-bottom:12px">
          <strong>${App.esc(billingMonth)}</strong> · ${list.length}건 ·
          공급가액 ${App.won(supplySum)} · 부가세 ${App.won(vatSum)} · 합계 ${App.won(totalSum)}
        </div>
        <div class="sme-panel">
        ${list.length ? `<table class="sme-table"><thead><tr>
            <th>청구번호</th><th>거래처</th><th class="num">공급가액</th><th class="num">부가세</th>
            <th class="num">합계</th><th>상태</th><th>세금계산서</th></tr></thead><tbody>
          ${list.map((i) => `<tr><td>${App.esc(i.invoiceNo)}</td><td>${App.esc(i.partnerName || '')}</td>
            <td class="num">${App.won(i.supplyAmount)}</td><td class="num">${App.won(i.vatAmount)}</td>
            <td class="num">${App.won(i.totalAmount)}</td><td>${App.statusBadge(i.status)}</td>
            <td>${App.esc(i.taxDocStatus || '')}</td></tr>`).join('')}</tbody></table>`
          : '<p class="sme-empty">이 달의 청구서가 없습니다. [월 일괄 청구서 생성]을 눌러보세요.</p>'}
        </div>`;

      root.querySelector('#inv-month').addEventListener('change', (e) => {
        if (/^\d{4}-\d{2}$/.test(e.target.value)) { billingMonth = e.target.value; draw(); }
      });
      root.querySelector('#inv-batch').addEventListener('click', openPreview);
    }

    async function openPreview() {
      let partners = [];
      try {
        partners = await App.call('partners', 'list', { companyId });
      } catch (e) {
        App.toast(e.message, 'error');
        return;
      }
      const cands = partners.map((p) => {
        const supply = (Array.isArray(p.priceTable) ? p.priceTable : [])
          .reduce((acc, it) => acc + (Number(it.unitPrice) || 0), 0);
        return { partner: p, supply, vat: vatOf(supply), total: supply + vatOf(supply) };
      });
      const sumS = cands.reduce((s, c) => s + (c.supply > 0 ? c.supply : 0), 0);
      const sumV = cands.reduce((s, c) => s + (c.supply > 0 ? c.vat : 0), 0);

      const back = App.modal(`
        <h3 style="margin-top:0">${App.esc(billingMonth)} 정기 청구서 일괄 생성</h3>
        <p class="sme-sub">대상 ${cands.length}곳 · 총 공급가액 ${App.won(sumS)} · 부가세 ${App.won(sumV)} (단가표 없는 거래처는 제외됩니다)</p>
        <table class="sme-table"><thead><tr><th></th><th>거래처</th><th class="num">공급가액</th><th class="num">부가세</th><th class="num">합계</th></tr></thead><tbody>
        ${cands.map((c) => `<tr><td><input type="checkbox" class="pv-check" value="${App.esc(c.partner.id)}" ${c.supply > 0 ? 'checked' : ''} ${c.supply > 0 ? '' : 'disabled'}></td>
          <td>${App.esc(c.partner.partnerName)}</td><td class="num">${App.won(c.supply)}</td>
          <td class="num">${App.won(c.vat)}</td><td class="num">${App.won(c.total)}</td></tr>`).join('')}
        </tbody></table>
        <p class="sme-error" id="pv-error"></p>
        <div class="sme-row" style="margin-top:12px"><button class="sme-btn ghost" id="pv-cancel">취소</button>
        <button class="sme-btn" id="pv-ok">일괄 발행 확정</button></div>`);
      back.querySelector('#pv-cancel').addEventListener('click', () => App.closeModal());
      back.querySelector('#pv-ok').addEventListener('click', async () => {
        const ids = [...back.querySelectorAll('.pv-check:checked')].map((c) => c.value);
        const err = back.querySelector('#pv-error');
        try {
          const { summary } = await App.call('invoices', 'createBatch', { companyId, billingMonth, partnerIds: ids });
          App.closeModal();
          App.toast(`청구서 ${summary.totalCount}건 생성 (공급가액 ${App.won(summary.supplyTotal)}, 부가세 ${App.won(summary.vatTotal)}${summary.skippedCount ? `, 제외 ${summary.skippedCount}건` : ''})`, 'ok');
          draw();
        } catch (e) {
          err.textContent = e.message;
        }
      });
    }

    await draw();
  }
};
