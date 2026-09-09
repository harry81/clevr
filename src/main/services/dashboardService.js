function createDashboardService(db) {
  function prevMonth(baseMonth) {
    const [y, m] = baseMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function sumInvoices(companyId, billingMonth) {
    const row = billingMonth
      ? db.prepare('SELECT COALESCE(SUM(total_amount),0) AS s FROM invoices WHERE company_id = ? AND billing_month = ?').get(companyId, billingMonth)
      : db.prepare('SELECT COALESCE(SUM(total_amount),0) AS s FROM invoices WHERE company_id = ?').get(companyId);
    return row.s;
  }

  function sumPayments(companyId, yyyymm) {
    const row = yyyymm
      ? db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE company_id = ? AND substr(payment_date,1,7) = ?`).get(companyId, yyyymm)
      : db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE company_id = ?').get(companyId);
    return row.s;
  }

  function getDashboardSummary({ companyId, baseMonth } = {}) {
    if (!companyId) throw new Error('companyId가 필요합니다');
    if (!/^\d{4}-\d{2}$/.test(baseMonth || '')) {
      throw new Error('기준년월은 YYYY-MM 형식이어야 합니다');
    }

    const billedAmount = sumInvoices(companyId, baseMonth);
    const paidAmount = sumPayments(companyId, baseMonth);
    const outstandingAmount = sumInvoices(companyId) - sumPayments(companyId);

    const prevBilled = sumInvoices(companyId, prevMonth(baseMonth));
    const growthRate = prevBilled === 0 ? null : (billedAmount - prevBilled) / prevBilled;

    const recentInvoices = db.prepare(
      `SELECT i.id, i.invoice_no, i.partner_id, p.partner_name, i.billing_month,
              i.supply_amount, i.vat_amount, i.total_amount, i.issue_date, i.status
       FROM invoices i JOIN partners p ON p.id = i.partner_id
       WHERE i.company_id = ? ORDER BY i.issue_date DESC, i.created_at DESC LIMIT 5`
    ).all(companyId).map(r => ({
      id: r.id,
      invoiceNo: r.invoice_no,
      partnerId: r.partner_id,
      partnerName: r.partner_name,
      billingMonth: r.billing_month,
      supplyAmount: r.supply_amount,
      vatAmount: r.vat_amount,
      totalAmount: r.total_amount,
      issueDate: r.issue_date,
      status: r.status
    }));

    const topDebtors = db.prepare(
      `SELECT id, partner_name, outstanding FROM (
         SELECT p.id AS id, p.partner_name AS partner_name,
           COALESCE((SELECT SUM(total_amount) FROM invoices WHERE company_id = p.company_id AND partner_id = p.id), 0)
           - COALESCE((SELECT SUM(amount) FROM payments WHERE company_id = p.company_id AND partner_id = p.id), 0) AS outstanding
         FROM partners p WHERE p.company_id = ?
       ) WHERE outstanding > 0 ORDER BY outstanding DESC LIMIT 5`
    ).all(companyId).map(r => ({ partnerId: r.id, partnerName: r.partner_name, outstanding: r.outstanding }));

    return {
      companyId,
      baseMonth,
      kpi: { billedAmount, paidAmount, outstandingAmount, growthRate },
      recentInvoices,
      topDebtors
    };
  }

  return { getDashboardSummary };
}

module.exports = { createDashboardService };
