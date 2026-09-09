const VAT_RATE = 0.1;

function assertAmount(amount) {
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) {
    throw new Error('금액은 0 이상 정수(원)여야 합니다');
  }
}

function computeVat(supplyAmount) {
  assertAmount(supplyAmount);
  return Math.trunc(supplyAmount * VAT_RATE);
}

function computeTotal(supplyAmount) {
  return supplyAmount + computeVat(supplyAmount);
}

module.exports = { VAT_RATE, assertAmount, computeVat, computeTotal };