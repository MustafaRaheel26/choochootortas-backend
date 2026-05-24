/**
 * Payment Service Router
 * 
 * Switches between Mock and Datacap based on MOCK_PAYMENT_MODE
 */

let paymentService;

if (process.env.MOCK_PAYMENT_MODE === 'true') {
  console.log('[PaymentService] Using MOCK payment service');
  paymentService = require('./mockPaymentService');
} else {
  console.log('[PaymentService] Using REAL Datacap payment service');
  paymentService = require('./datacapPaymentService');
}

module.exports = paymentService;