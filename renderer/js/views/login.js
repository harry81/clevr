/* 로그인 화면 — sme.auth.login */
window.App.views.login = {
  title: '로그인',
  async render(root) {
    root.innerHTML = `
      <div class="sme-center"><div class="sme-card">
        <p class="sme-brand">SME-ERP</p>
        <p class="sme-sub">소규모 제조업용 오픈소스 ERP</p>
        <form id="login-form">
          <div class="sme-field"><label for="login-id">아이디</label>
            <input id="login-id" autocomplete="username" required></div>
          <div class="sme-field"><label for="login-pw">비밀번호</label>
            <input id="login-pw" type="password" autocomplete="current-password" required></div>
          <p class="sme-error" id="login-error"></p>
          <button class="sme-btn block" type="submit">로그인</button>
        </form>
      </div></div>`;
    root.querySelector('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = root.querySelector('#login-error');
      err.textContent = '';
      try {
        const { user } = await window.App.call('auth', 'login', {
          username: root.querySelector('#login-id').value.trim(),
          password: root.querySelector('#login-pw').value
        });
        window.App.state.user = user;
        window.App.state.companyId = user.companyId;
        window.App.navigate('dashboard');
      } catch (ex) {
        err.textContent = ex.message;
      }
    });
  }
};
