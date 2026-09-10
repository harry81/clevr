/* 온보딩 마법사(화면 ⑤) — 3단계 + 표준 단가표 체크박스, 60초 완주 UX */
window.App.views.onboarding = {
  title: '처음 설정',
  async render(root) {
    const App = window.App;
    const data = { company: {}, admin: {}, items: [], applyTemplate: true };
    let step = 1;

    const stepsBar = () => `
      <div class="sme-steps" aria-hidden="true">
        <span class="${step >= 1 ? 'on' : ''}"></span><span class="${step >= 2 ? 'on' : ''}"></span><span class="${step >= 3 ? 'on' : ''}"></span>
      </div>`;

    function maskBizNo(el) {
      el.addEventListener('input', () => {
        const d = el.value.replace(/\D/g, '').slice(0, 10);
        el.value = d.length > 5 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
          : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
      });
    }

    function itemRow(name = '', price = '') {
      return `<div class="sme-itemrow">
        <input class="ob-item-name" placeholder="품목명 (예: 정밀가공)" value="${App.esc(name)}">
        <input class="ob-item-price" inputmode="numeric" placeholder="기본단가" value="${App.esc(fmtPrice(price))}">
      </div>`;
    }

    function fmtPrice(v) {
      if (v === '' || v === null || v === undefined) return '';
      const digits = String(v).replace(/\D/g, '');
      if (!digits) return '';
      return Number(digits).toLocaleString('ko-KR');
    }

    function bindPriceComma(scope) {
      scope.querySelectorAll('.ob-item-price').forEach((el) => {
        if (el._commaBound) return;
        el._commaBound = true;
        el.addEventListener('input', () => {
          const digits = el.value.replace(/\D/g, '');
          el.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
        });
      });
    }

    function draw() {
      let body = '';
      if (step === 1) {
        body = `
          <div class="sme-field"><label>상호 *</label><input id="ob-cn" value="${App.esc(data.company.companyName || '')}" required></div>
          <div class="sme-field"><label>사업자번호 * (000-00-00000)</label><input id="ob-biz" inputmode="numeric" value="${App.esc(data.company.bizNo || '')}" placeholder="000-00-00000" required></div>
          <div class="sme-row">
            <div class="sme-field"><label>대표자</label><input id="ob-ceo" value="${App.esc(data.company.ceoName || '')}"></div>
            <div class="sme-field"><label>대표전화</label><input id="ob-tel" value="${App.esc(data.company.tel || '')}" placeholder="054-000-0000"></div>
          </div>
          <div class="sme-row">
            <div class="sme-field"><label>업태</label><input id="ob-bt" value="${App.esc(data.company.bizType || '')}" placeholder="제조업"></div>
            <div class="sme-field"><label>종목</label><input id="ob-bi" value="${App.esc(data.company.bizItem || '')}" placeholder="정밀가공"></div>
          </div>
          <div class="sme-field"><label>주소</label><input id="ob-addr" value="${App.esc(data.company.address || '')}"></div>
          <p class="sme-error" id="ob-error"></p>
          <button class="sme-btn block" data-go="2">다음</button>`;
      } else if (step === 2) {
        body = `
          <div class="sme-field"><label>관리자 아이디 *</label><input id="ob-uid" autocomplete="username" value="${App.esc(data.admin.username || '')}" required></div>
          <div class="sme-field"><label>관리자 비밀번호 *</label><input id="ob-pw" type="password" autocomplete="new-password" required></div>
          <div class="sme-field"><label>비밀번호 확인 *</label><input id="ob-pw2" type="password" autocomplete="new-password" required></div>
          <p class="sme-error" id="ob-error"></p>
          <div class="sme-row"><button class="sme-btn ghost" data-go="1">이전</button><button class="sme-btn" data-go="3">다음</button></div>`;
      } else {
        body = `
          <p class="sme-sub">자주 쓰는 품목과 단가를 미리 등록해 두면 월 청구서 생성이 빨라집니다.</p>
          <div id="ob-items">${(data.items.length ? data.items : [{ itemName: '', unitPrice: '' }]).map((it) => itemRow(it.itemName, it.unitPrice)).join('')}</div>
          <button class="sme-btn ghost" id="ob-add-item" type="button">+ 품목 추가</button>
          <label class="sme-check"><input type="checkbox" id="ob-tpl" ${data.applyTemplate ? 'checked' : ''}>
            <span><strong>소규모 가공/제조업 표준 단가표 적용</strong><br>기본 거래처 3곳과 대표 품목(정밀가공·밀링가공·레이저절단)이 자동 등록됩니다.</span></label>
          <p class="sme-error" id="ob-error"></p>
          <div class="sme-row"><button class="sme-btn ghost" data-go="2">이전</button><button class="sme-btn" id="ob-finish">설정 완료</button></div>`;
      }
      root.innerHTML = `<div class="sme-center"><div class="sme-card wide">
        <p class="sme-brand">SME-ERP 처음 설정</p>
        <p class="sme-sub">1분이면 끝납니다 (${step}/3단계)</p>
        ${stepsBar()}${body}</div></div>`;

      const biz = root.querySelector('#ob-biz');
      if (biz) maskBizNo(biz);
      bindPriceComma(root);
      root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
        if (!collect(b.dataset.go)) return;
        step = Number(b.dataset.go);
        draw();
      }));
      const addBtn = root.querySelector('#ob-add-item');
      if (addBtn) addBtn.addEventListener('click', () => {
        collect(3);
        data.items.push({ itemName: '', unitPrice: '' });
        draw();
      });
      const finish = root.querySelector('#ob-finish');
      if (finish) finish.addEventListener('click', () => finishAll());
    }

    function collect(next) {
      const err = root.querySelector('#ob-error');
      const bad = (m) => { if (err) err.textContent = m; return false; };
      if (step === 1) {
        data.company = {
          companyName: root.querySelector('#ob-cn').value.trim(),
          bizNo: root.querySelector('#ob-biz').value.trim(),
          ceoName: root.querySelector('#ob-ceo').value.trim(),
          tel: root.querySelector('#ob-tel').value.trim(),
          bizType: root.querySelector('#ob-bt').value.trim(),
          bizItem: root.querySelector('#ob-bi').value.trim(),
          address: root.querySelector('#ob-addr').value.trim()
        };
        if (!data.company.companyName) return bad('상호를 입력하세요.');
        if (!/^\d{3}-\d{2}-\d{5}$/.test(data.company.bizNo)) return bad('사업자번호 형식이 올바르지 않습니다 (000-00-00000).');
      }
      if (step === 2 && next === '3') {
        data.admin = {
          username: root.querySelector('#ob-uid').value.trim(),
          password: root.querySelector('#ob-pw').value
        };
        if (!data.admin.username) return bad('관리자 아이디를 입력하세요.');
        if (!data.admin.password) return bad('관리자 비밀번호를 입력하세요.');
        if (data.admin.password !== root.querySelector('#ob-pw2').value) return bad('비밀번호가 일치하지 않습니다.');
      }
      if (step === 3) {
        const names = [...root.querySelectorAll('.ob-item-name')];
        const prices = [...root.querySelectorAll('.ob-item-price')];
        data.items = [];
        for (let i = 0; i < names.length; i++) {
          const name = names[i].value.trim();
          const priceRaw = prices[i].value.replace(/[^0-9]/g, '');
          if (!name && !priceRaw) continue;
          if (!name) return bad('품목명을 입력하세요.');
          const price = Number(priceRaw || 0);
          if (!Number.isInteger(price) || price < 0) return bad('단가는 0 이상의 숫자여야 합니다.');
          data.items.push({ itemName: name, unitPrice: price });
        }
        const tpl = root.querySelector('#ob-tpl');
        data.applyTemplate = !!(tpl && tpl.checked);
      }
      return true;
    }

    async function finishAll() {
      if (!collect(3)) return;
      const err = root.querySelector('#ob-error');
      try {
        await App.call('onboarding', 'submit', {
          company: data.company,
          admin: data.admin,
          items: data.items,
          applyTemplate: data.applyTemplate
        });
        const { user } = await App.call('auth', 'login', {
          username: data.admin.username,
          password: data.admin.password
        });
        App.state.user = user;
        App.state.companyId = user.companyId;
        App.toast('설정이 완료되었습니다.', 'ok');
        App.navigate('dashboard');
      } catch (e) {
        err.textContent = e.message;
      }
    }

    draw();
  }
};
