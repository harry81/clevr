/* 거래처 관리(화면 ②) — 목록 + 슬라이드오버 등록/단가표 편집 */
window.App.views.partners = {
  title: '거래처 관리',
  async render(root, params) {
    const App = window.App;
    const companyId = App.state.companyId;
    let keyword = (params && params.keyword) || '';
    let list = [];

    function priceSummary(p) {
      const table = Array.isArray(p.priceTable) ? p.priceTable : [];
      if (!table.length) return '—';
      const first = table[0];
      const head = `${first.itemName} ${App.won(first.unitPrice)}`;
      return table.length > 1 ? `${head} 외 ${table.length - 1}건` : head;
    }

    function maskBizNo(el) {
      el.addEventListener('input', () => {
        const d = el.value.replace(/\D/g, '').slice(0, 10);
        el.value = d.length > 5 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
          : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
      });
    }

    function itemRow(name = '', price = '') {
      return `<div class="sme-itemrow" data-itemrow>
        <input class="pt-item-name" placeholder="품목명" value="${App.esc(name)}">
        <input class="pt-item-price" inputmode="numeric" placeholder="단가" value="${App.esc(fmtPrice(price))}">
        <button type="button" class="sme-btn ghost pt-item-del" style="flex:0 0 auto;padding:9px 12px">삭제</button>
      </div>`;
    }

    function fmtPrice(v) {
      if (v === '' || v === null || v === undefined) return '';
      const digits = String(v).replace(/\D/g, '');
      if (!digits) return '';
      return Number(digits).toLocaleString('ko-KR');
    }

    function formatPriceInput(el) {
      const digits = el.value.replace(/\D/g, '');
      el.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
    }

    function bindPriceComma(scope) {
      scope.querySelectorAll('.pt-item-price').forEach((el) => {
        if (el._commaBound) return;
        el._commaBound = true;
        el.addEventListener('input', () => formatPriceInput(el));
      });
    }

    async function draw() {
      try {
        list = await App.call('partners', 'list', { companyId, keyword });
      } catch (e) {
        root.innerHTML = `<p class="sme-error">${App.esc(e.message)}</p>`;
        return;
      }
      root.innerHTML = `
        <div class="sme-toolbar">
          <input id="pt-search" placeholder="거래처명 또는 사업자번호 검색" value="${App.esc(keyword)}" style="min-width:260px">
          <button class="sme-btn" id="pt-new">+ 신규 거래처 등록</button>
          <span class="sme-sub" style="margin:0">총 ${list.length}곳</span>
        </div>
        <div class="sme-panel">
        ${list.length ? `<table class="sme-table"><thead><tr>
            <th>코드</th><th>거래처명</th><th>사업자번호</th><th>대표자</th><th>연락처</th><th>품목/단가</th><th class="num">미수잔액</th>
          </tr></thead><tbody>
          ${list.map((p) => `<tr data-pid="${App.esc(p.id)}" style="cursor:pointer">
            <td>${App.esc(p.partnerCode || '')}</td>
            <td><strong>${App.esc(p.partnerName)}</strong></td>
            <td>${App.esc(p.bizNo || '')}</td>
            <td>${App.esc(p.ceoName || '')}</td>
            <td>${App.esc(p.tel || p.email || '') || '—'}</td>
            <td>${App.esc(priceSummary(p))}</td>
            <td class="num"><strong>${App.esc(App.won(p.outstandingBalance || 0))}</strong></td>
          </tr>`).join('')}</tbody></table>`
          : '<p class="sme-empty">등록된 거래처가 없습니다. [신규 거래처 등록]을 눌러보세요.</p>'}
        </div>`;

      const search = root.querySelector('#pt-search');
      search.addEventListener('input', () => {
        clearTimeout(search._t);
        search._t = setTimeout(() => { keyword = search.value.trim(); draw(); }, 250);
      });
      root.querySelector('#pt-new').addEventListener('click', () => openDrawer(null));
      root.querySelectorAll('[data-pid]').forEach((tr) => tr.addEventListener('click', () => {
        const found = list.find((p) => String(p.id) === String(tr.dataset.pid));
        openDrawer(found || null);
      }));
    }

    function openDrawer(partner) {
      closeDrawer();
      const isEdit = !!(partner && partner.id);
      const table = (partner && Array.isArray(partner.priceTable) && partner.priceTable.length)
        ? partner.priceTable
        : [{ itemName: '', unitPrice: '' }];

      const overlay = document.createElement('div');
      overlay.id = 'pt-drawer-back';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:60;display:flex;justify-content:flex-end';
      overlay.innerHTML = `
        <div id="pt-drawer" style="width:min(480px,92vw);height:100%;background:#fff;box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);transform:translateX(100%);transition:transform 200ms ease;overflow:auto;padding:20px">
          <h3 style="margin-top:0">${isEdit ? '거래처 편집' : '신규 거래처 등록'}</h3>
          ${isEdit ? `<p class="sme-sub">코드 ${App.esc(partner.partnerCode || '')}</p>` : '<p class="sme-sub">코드는 저장 시 자동 채번됩니다.</p>'}
          <div class="sme-field"><label>상호 *</label><input id="pt-name" value="${App.esc(partner ? partner.partnerName : '')}" placeholder="거래처 상호"></div>
          <div class="sme-field"><label>사업자번호 * (000-00-00000)</label><input id="pt-bizno" inputmode="numeric" value="${App.esc(partner ? partner.bizNo : '')}" placeholder="000-00-00000"></div>
          <div class="sme-row">
            <div class="sme-field"><label>대표자</label><input id="pt-ceo" value="${App.esc(partner ? partner.ceoName : '')}"></div>
            <div class="sme-field"><label>전화</label><input id="pt-tel" value="${App.esc(partner ? partner.tel : '')}" placeholder="054-000-0000"></div>
          </div>
          <div class="sme-field"><label>이메일</label><input id="pt-email" value="${App.esc(partner ? partner.email : '')}" placeholder="mail@example.com"></div>
          <div class="sme-row">
            <div class="sme-field"><label>업태</label><input id="pt-btype" value="${App.esc(partner ? partner.bizType : '')}" placeholder="제조업"></div>
            <div class="sme-field"><label>종목</label><input id="pt-bitem" value="${App.esc(partner ? partner.bizItem : '')}" placeholder="정밀가공"></div>
          </div>
          <div class="sme-field"><label>품목단가표 (품목명 + 단가, 단가는 0 이상 정수)</label>
            <div id="pt-items">${table.map((it) => itemRow(it.itemName, it.unitPrice === '' ? '' : String(it.unitPrice))).join('')}</div>
            <button type="button" class="sme-btn ghost" id="pt-add-item" style="margin-top:8px">+ 품목 추가</button>
          </div>
          <p class="sme-error" id="pt-error"></p>
          <div class="sme-row" style="margin-top:12px">
            <button class="sme-btn ghost" id="pt-cancel">닫기</button>
            ${isEdit ? '<button class="sme-btn danger" id="pt-del">삭제</button>' : ''}
            <button class="sme-btn" id="pt-save">저장</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const panel = overlay.querySelector('#pt-drawer');
      requestAnimationFrame(() => requestAnimationFrame(() => { panel.style.transform = 'translateX(0)'; }));
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeDrawer(); });

      const bizEl = overlay.querySelector('#pt-bizno');
      maskBizNo(bizEl);

      const itemsBox = overlay.querySelector('#pt-items');
      const bindDel = () => itemsBox.querySelectorAll('.pt-item-del').forEach((b) => {
        b.onclick = () => { b.closest('[data-itemrow]').remove(); };
      });
      bindDel();
      bindPriceComma(overlay);
      overlay.querySelector('#pt-add-item').addEventListener('click', () => {
        itemsBox.insertAdjacentHTML('beforeend', itemRow('', ''));
        bindDel();
        bindPriceComma(overlay);
      });
      overlay.querySelector('#pt-cancel').addEventListener('click', () => closeDrawer());

      function collect() {
        const err = overlay.querySelector('#pt-error');
        const bad = (m) => { err.textContent = m; return null; };
        const partnerName = overlay.querySelector('#pt-name').value.trim();
        const bizNo = overlay.querySelector('#pt-bizno').value.trim();
        if (!partnerName) return bad('상호를 입력하세요.');
        if (!bizNo) return bad('사업자번호를 입력하세요.');
        if (!/^\d{3}-\d{2}-\d{5}$/.test(bizNo)) return bad('사업자번호 형식이 올바르지 않습니다 (000-00-00000).');
        const email = overlay.querySelector('#pt-email').value.trim();
        if (email && !/^\S+@\S+\.\S+$/.test(email)) return bad('이메일 형식이 올바르지 않습니다.');
        const rows = [...itemsBox.querySelectorAll('[data-itemrow]')];
        const priceTable = [];
        for (let i = 0; i < rows.length; i++) {
          const n = rows[i].querySelector('.pt-item-name').value.trim();
          const raw = rows[i].querySelector('.pt-item-price').value.replace(/[^0-9]/g, '');
          if (!n && !raw) continue;
          if (!n) return bad(`품목단가표 ${i + 1}번째 항목: 품목명을 입력하세요.`);
          const unitPrice = Number(raw || 0);
          if (!Number.isInteger(unitPrice) || unitPrice < 0) return bad(`품목단가표 ${i + 1}번째 항목(${n}): 단가는 0 이상 정수여야 합니다.`);
          priceTable.push({ itemName: n, unitPrice });
        }
        return {
          id: isEdit ? partner.id : undefined,
          partnerCode: isEdit ? partner.partnerCode : undefined,
          partnerName,
          bizNo,
          ceoName: overlay.querySelector('#pt-ceo').value.trim(),
          tel: overlay.querySelector('#pt-tel').value.trim(),
          email,
          bizType: overlay.querySelector('#pt-btype').value.trim(),
          bizItem: overlay.querySelector('#pt-bitem').value.trim(),
          priceTable
        };
      }

      overlay.querySelector('#pt-save').addEventListener('click', async () => {
        const err = overlay.querySelector('#pt-error');
        err.textContent = '';
        const data = collect();
        if (!data) return;
        try {
          await App.call('partners', 'save', { companyId, partner: data });
          App.toast('거래처가 저장되었습니다.', 'ok');
          closeDrawer();
          draw();
        } catch (e) {
          err.textContent = e.message;
        }
      });

      const delBtn = overlay.querySelector('#pt-del');
      if (delBtn) delBtn.addEventListener('click', () => {
        const back = App.modal(`
          <h3 style="margin-top:0">거래처 삭제</h3>
          <p>${App.esc(partner.partnerName)} (${App.esc(partner.partnerCode || '')}) 을(를) 삭제하시겠습니까?</p>
          <p class="sme-error" id="pt-del-error"></p>
          <div class="sme-row" style="margin-top:12px">
            <button class="sme-btn ghost" id="pt-del-cancel">취소</button>
            <button class="sme-btn danger" id="pt-del-ok">삭제 확정</button>
          </div>`);
        back.querySelector('#pt-del-cancel').addEventListener('click', () => App.closeModal());
        back.querySelector('#pt-del-ok').addEventListener('click', async () => {
          try {
            await App.call('partners', 'delete', { companyId, partnerId: partner.id });
            App.closeModal();
            App.toast('거래처가 삭제되었습니다.', 'ok');
            closeDrawer();
            draw();
          } catch (e) {
            back.querySelector('#pt-del-error').textContent = e.message;
          }
        });
      });
    }

    function closeDrawer() {
      const overlay = document.getElementById('pt-drawer-back');
      if (!overlay) return;
      const panel = overlay.querySelector('#pt-drawer');
      if (panel) panel.style.transform = 'translateX(100%)';
      setTimeout(() => overlay.remove(), 180);
    }

    async function refreshDetail(partnerId) {
      try {
        const one = await App.call('partners', 'get', { companyId, partnerId });
        return one;
      } catch (e) {
        return null;
      }
    }
    void refreshDetail;

    await draw();
  }
};
