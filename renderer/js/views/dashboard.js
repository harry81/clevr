/* 대시보드(화면 ①) — KPI 3종 + 최근 청구서 5건 + 미수 TOP5 */
window.App.views.dashboard = {
  title: '대시보드',
  async render(root, params) {
    const App = window.App;
    const companyId = App.state.companyId;
    let baseMonth = (params && params.baseMonth) || App.monthStr();

    const shiftMonth = (ym, delta) => {
      const [y, m] = ym.split('-').map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const monthLabel = (ym) => {
      const [y, m] = ym.split('-');
      return `${y}년 ${Number(m)}월`;
    };

    async function draw() {
      let summary;
      try {
        summary = await App.call('dashboard', 'getSummary', { companyId, baseMonth });
      } catch (e) {
        root.innerHTML = `<p class="sme-error">${App.esc(e.message)}</p>`;
        return;
      }
      const { kpi, recentInvoices, topDebtors } = summary;
      const growth = kpi.growthRate === null || kpi.growthRate === undefined
        ? '<span class="sme-badge">—</span>'
        : `<span class="sme-badge ${kpi.growthRate >= 0 ? 'up' : 'down'}">${kpi.growthRate >= 0 ? '+' : ''}${(kpi.growthRate * 100).toFixed(1)}%</span>`;

      root.innerHTML = `
        <div class="sme-toolbar">
          <button class="sme-btn ghost" data-m="-1">◀ 이전달</button>
          <input type="month" id="dash-month" value="${App.esc(baseMonth)}">
          <button class="sme-btn ghost" data-m="1">다음달 ▶</button>
          <span class="sme-sub" style="margin:0">${App.esc(monthLabel(baseMonth))} 기준</span>
        </div>
        <div class="sme-kpis">
          <div class="sme-kpi"><div class="k-label">이번달 매출 청구액 ${growth}</div><div class="k-value">${App.won(kpi.billedAmount)}</div></div>
          <div class="sme-kpi"><div class="k-label">이번달 입금액</div><div class="k-value">${App.won(kpi.paidAmount)}</div></div>
          <div class="sme-kpi danger"><div class="k-label">현재 미수금 잔액</div><div class="k-value">${App.won(kpi.outstandingAmount)}</div></div>
        </div>
        <div class="sme-grid2">
          <div class="sme-panel"><h3>최근 발행 청구서</h3>
            ${recentInvoices.length ? `<table class="sme-table"><thead><tr><th>청구일</th><th>거래처</th><th class="num">청구금액</th><th>상태</th></tr></thead>
            <tbody>${recentInvoices.map((i) => `<tr><td>${App.esc(i.issueDate || '')}</td><td>${App.esc(i.partnerName || '')}</td>
              <td class="num">${App.won(i.totalAmount)}</td><td>${App.statusBadge(i.status)}</td></tr>`).join('')}</tbody></table>`
              : '<p class="sme-empty">발행된 청구서가 없습니다.</p>'}</div>
          <div class="sme-panel"><h3>거래처별 미수 잔액 TOP 5</h3>
            ${topDebtors.length ? `<table class="sme-table"><tbody>
              ${topDebtors.map((t) => `<tr><td>${App.esc(t.partnerName)}</td><td class="num">${App.won(t.outstanding)}</td>
                <td><button class="sme-link" data-ledger="${App.esc(t.partnerId)}">원장 바로가기</button></td></tr>`).join('')}
              </tbody></table>` : '<p class="sme-empty">미수금이 없습니다.</p>'}</div>
        </div>`;

      root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
        baseMonth = shiftMonth(baseMonth, Number(b.dataset.m));
        draw();
      }));
      root.querySelector('#dash-month').addEventListener('change', (e) => {
        if (/^\d{4}-\d{2}$/.test(e.target.value)) { baseMonth = e.target.value; draw(); }
      });
      root.querySelectorAll('[data-ledger]').forEach((b) => b.addEventListener('click', () => {
        App.navigate('ledger', { partnerId: b.dataset.ledger });
      }));
    }

    await draw();
  }
};
