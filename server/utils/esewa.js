/**
 * eSewa Epay v2 amount + status-check helpers (sandbox + production).
 */

function formatEsewaAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Invalid eSewa amount');
  }
  return n.toFixed(2);
}

function buildEsewaSignature({ secret, totalAmount, transactionUuid, productCode }) {
  const crypto = require('crypto');
  const total = formatEsewaAmount(totalAmount);
  const message = `total_amount=${total},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const signature = crypto.createHmac('sha256', secret).update(message).digest('base64');
  return { signature, total, message };
}

/** Amount variants eSewa status API may expect for the same payment. */
function esewaStatusAmountCandidates(amount) {
  const base = Number(amount);
  const candidates = [
    formatEsewaAmount(base),
    String(base),
    String(Math.round(base)),
  ];
  return [...new Set(candidates)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll eSewa status API — sandbox can return PENDING briefly after redirect.
 */
async function verifyEsewaPaymentStatus(axios, { statusUrl, merchantId, transactionUuid, amount }) {
  const amounts = esewaStatusAmountCandidates(amount);
  const maxAttempts = 4;
  const delayMs = 1200;

  let lastData = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    for (const total_amount of amounts) {
      try {
        const verifyRes = await axios.get(statusUrl, {
          params: {
            product_code: merchantId,
            total_amount,
            transaction_uuid: transactionUuid,
          },
        });
        if (verifyRes.data) lastData = verifyRes.data;
        if (verifyRes.data?.status === 'COMPLETE') {
          return { ok: true, data: verifyRes.data, total_amount };
        }
      } catch {
        // try next amount / attempt
      }
    }
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }
  return { ok: false, data: lastData, total_amount: null };
}

module.exports = {
  formatEsewaAmount,
  buildEsewaSignature,
  verifyEsewaPaymentStatus,
};
