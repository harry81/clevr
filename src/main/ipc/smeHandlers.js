const { verifyPassword } = require('../../shared/security/hasher');
const { isOnboardingNeeded, completeOnboarding } = require('../services/onboardingService');
const { createPartnerService } = require('../services/partnerService');
const { createInvoiceService } = require('../services/invoiceService');
const { createLedgerService } = require('../services/ledgerService');
const { createDashboardService } = require('../services/dashboardService');

const INVOICE_STATUSES = ['UNPAID', 'PARTIAL', 'PAID'];

function createSessionStore() {
  let currentUser = null;
  return {
    get: () => currentUser,
    set: (user) => { currentUser = user; },
    clear: () => { currentUser = null; }
  };
}

function ok(data) {
  return { ok: true, data };
}

function fail(err) {
  const message = err && err.message ? err.message : String(err);
  return { ok: false, message };
}

function need(payload, ...fields) {
  for (const f of fields) {
    const v = payload ? payload[f] : undefined;
    if (v === undefined || v === null || v === '') throw new Error(`${f}가 필요합니다`);
  }
}

function toInvoice(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    partnerId: row.partner_id,
    partnerName: row.partner_name ?? null,
    invoiceNo: row.invoice_no,
    billingMonth: row.billing_month,
    supplyAmount: row.supply_amount,
    vatAmount: row.vat_amount,
    totalAmount: row.total_amount,
    issueDate: row.issue_date,
    status: row.status,
    taxDocStatus: row.tax_doc_status
  };
}

function createSmeHandlers({ db, session }) {
  const partners = createPartnerService(db);
  const invoices = createInvoiceService(db);
  const ledger = createLedgerService(db);
  const dashboard = createDashboardService(db);

  async function login(payload) {
    need(payload, 'username', 'password');
    const { companyId, username, password } = payload;
    let row;
    if (companyId) {
      row = db.prepare('SELECT * FROM users WHERE company_id = ? AND username = ?').get(companyId, username);
    } else {
      const rows = db.prepare('SELECT * FROM users WHERE username = ?').all(username);
      if (rows.length > 1) throw new Error('여러 사업장에 같은 아이디가 있습니다. 회사ID를 지정해주세요.');
      row = rows[0];
    }
    if (!row || !verifyPassword(password, row.password_hash, row.salt)) {
      throw new Error('아이디 또는 비밀번호를 확인해주세요.');
    }
    const user = { id: row.id, companyId: row.company_id, username: row.username, role: row.role };
    session.set(user);
    return { user };
  }

  function listInvoices(payload) {
    need(payload, 'companyId');
    const { companyId, partnerId, billingMonth } = payload;
    let sql = 'SELECT i.*, p.partner_name FROM invoices i LEFT JOIN partners p ON p.id = i.partner_id WHERE i.company_id = ?';
    const args = [companyId];
    if (partnerId) { sql += ' AND i.partner_id = ?'; args.push(partnerId); }
    if (billingMonth) { sql += ' AND i.billing_month = ?'; args.push(billingMonth); }
    sql += ' ORDER BY i.issue_date DESC, i.invoice_no DESC';
    return db.prepare(sql).all(...args).map(toInvoice);
  }

  function updateInvoiceStatus(payload) {
    need(payload, 'companyId', 'invoiceId', 'status');
    const { companyId, invoiceId, status } = payload;
    if (!INVOICE_STATUSES.includes(status)) {
      throw new Error(`status는 ${INVOICE_STATUSES.join('/')} 중 하나여야 합니다`);
    }
    const result = db.prepare('UPDATE invoices SET status = ? WHERE id = ? AND company_id = ?')
      .run(status, invoiceId, companyId);
    if (result.changes === 0) throw new Error('청구서를 찾을 수 없습니다');
    const row = db.prepare('SELECT i.*, p.partner_name FROM invoices i LEFT JOIN partners p ON p.id = i.partner_id WHERE i.id = ?')
      .get(invoiceId);
    return toInvoice(row);
  }

  const raw = {
    'sme:auth:login': login,
    'sme:auth:logout': () => {
      session.clear();
      return { loggedOut: true };
    },
    'sme:auth:checkSession': () => ({ user: session.get() }),
    'sme:onboarding:getStatus': () => ({ needed: isOnboardingNeeded(db) }),
    'sme:onboarding:submit': (payload) => {
      need(payload, 'company', 'admin');
      return completeOnboarding(
        db,
        { company: payload.company, admin: payload.admin, items: payload.items || [] },
        { applyTemplate: payload.applyTemplate === true }
      );
    },
    'sme:dashboard:getSummary': (payload) => {
      need(payload, 'companyId', 'baseMonth');
      return dashboard.getDashboardSummary({ companyId: payload.companyId, baseMonth: payload.baseMonth });
    },
    'sme:partners:list': (payload) => {
      need(payload, 'companyId');
      return partners.listPartners(payload.companyId, payload.keyword || '');
    },
    'sme:partners:get': (payload) => {
      need(payload, 'companyId', 'partnerId');
      const found = partners.getPartner(payload.companyId, payload.partnerId);
      if (!found) throw new Error('거래처를 찾을 수 없습니다');
      return found;
    },
    'sme:partners:save': (payload) => {
      need(payload, 'companyId', 'partner');
      return partners.savePartner(payload.companyId, payload.partner);
    },
    'sme:partners:delete': (payload) => {
      need(payload, 'companyId', 'partnerId');
      const result = partners.deletePartner(payload.companyId, payload.partnerId);
      return { deleted: result.ok };
    },
    'sme:invoices:list': listInvoices,
    'sme:invoices:createBatch': (payload) => {
      need(payload, 'companyId', 'billingMonth');
      return invoices.createInvoiceBatch({
        companyId: payload.companyId,
        billingMonth: payload.billingMonth,
        partnerIds: payload.partnerIds
      });
    },
    'sme:invoices:updateStatus': updateInvoiceStatus,
    'sme:ledger:getPartnerLedger': (payload) => {
      need(payload, 'companyId', 'partnerId');
      return ledger.getPartnerLedger({ companyId: payload.companyId, partnerId: payload.partnerId });
    },
    'sme:ledger:recordPayment': (payload) => {
      need(payload, 'companyId', 'partnerId', 'paymentDate', 'amount');
      return ledger.recordPayment({
        companyId: payload.companyId,
        partnerId: payload.partnerId,
        paymentDate: payload.paymentDate,
        amount: payload.amount,
        method: payload.method,
        memo: payload.memo
      });
    }
  };

  const wrapped = {};
  for (const [channel, fn] of Object.entries(raw)) {
    wrapped[channel] = async (payload) => {
      try {
        return ok(await fn(payload || {}));
      } catch (err) {
        return fail(err);
      }
    };
  }
  return wrapped;
}

module.exports = { createSmeHandlers, createSessionStore, INVOICE_STATUSES };
