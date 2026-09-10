/* SME-ERP SPA core — all IPC via window.api.sme.* (R1: no legacy channels) */
window.App = (() => {
  // Preload(T8)가 보장하는 브릿지. window.api.sme.* 외 호출 금지.
  const smeBridge = () => {
    if (!window.api || !window.api.sme) throw new Error('preload 브릿지(window.api.sme)를 찾을 수 없습니다');
    return window.api.sme;
  };

  const state = { user: null, companyId: null, view: 'login', params: {} };
  const views = {};

  const fmt = new Intl.NumberFormat('ko-KR');
  const won = (n) => '₩' + fmt.format(Math.trunc(Number(n) || 0));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const todayStr = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const monthStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  async function call(group, method, payload) {
    const fn = smeBridge()[group] && smeBridge()[group][method];
    if (typeof fn !== 'function') throw new Error(`지원하지 않는 API: sme.${group}.${method}`);
    const res = await fn(payload || {});
    if (!res || !res.ok) throw new Error((res && res.message) || '요청 실패');
    return res.data;
  }

  function toast(msg, type = '') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `sme-toast ${type}`.trim();
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function modal(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="sme-modal-back"><div class="sme-modal">${html}</div></div>`;
    const back = root.firstElementChild;
    back.addEventListener('mousedown', (e) => { if (e.target === back) closeModal(); });
    return back;
  }
  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  function statusBadge(status) {
    const label = { PAID: '완납', PARTIAL: '부분입금', UNPAID: '미납' }[status] || status;
    return `<span class="sme-status ${esc(status)}">${esc(label)}</span>`;
  }

  function navigate(view, params) {
    state.view = view;
    state.params = params || {};
    render().catch((e) => toast(e.message, 'error'));
  }

  function shell(title, bodyHtml) {
    const v = state.view;
    const nav = (id, label) => `<button data-nav="${id}" class="${v === id ? 'active' : ''}">${label}</button>`;
    return `
      <header class="sme-top">
        <div class="sme-logo">SME-ERP</div>
        <nav class="sme-nav">
          ${nav('dashboard', '대시보드')}
          ${nav('invoices', '청구서')}
          ${nav('ledger', '입금/원장')}
        </nav>
        <div class="sme-user"><span>${esc(state.user ? state.user.username : '')}</span><button class="sme-btn ghost" data-act="logout">로그아웃</button></div>
      </header>
      <main class="sme-main"><h2 class="sme-title">${esc(title)}</h2>${bodyHtml}</main>`;
  }

  async function render() {
    const root = document.getElementById('app');
    if (!state.user) {
      if (state.view === 'onboarding') await views.onboarding.render(root, {});
      else await views.login.render(root, {});
      return;
    }
    const view = views[state.view] || views.dashboard;
    root.innerHTML = shell(view.title || '', '<div id="view-body"><p class="sme-empty">불러오는 중…</p></div>');
    root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));
    const logoutBtn = root.querySelector('[data-act="logout"]');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
      try { await call('auth', 'logout', {}); } catch (e) { /* ignore */ }
      state.user = null; state.companyId = null;
      navigate('login');
    });
    await view.render(document.getElementById('view-body'), state.params);
  }

  async function boot() {
    try {
      const { user } = await call('auth', 'checkSession', {});
      if (user) {
        state.user = user; state.companyId = user.companyId;
        state.view = 'dashboard';
        await render();
        return;
      }
      const { needed } = await call('onboarding', 'getStatus', {});
      state.view = needed ? 'onboarding' : 'login';
      await render();
    } catch (e) {
      document.getElementById('app').innerHTML =
        `<div class="sme-center"><div class="sme-card"><p class="sme-brand">SME-ERP</p><p class="sme-error">${esc(e.message)}</p></div></div>`;
    }
  }

  return { state, views, call, won, esc, toast, modal, closeModal, statusBadge, navigate, todayStr, monthStr, boot };
})();
