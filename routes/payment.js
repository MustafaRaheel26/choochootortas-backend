/**
 * Payment Routes - Datacap/NETePay Integration
 * 
 * Used by:
 * - KIOSK: POST /api/payment/initiate (start payment)
 * - KIOSK: GET /api/payment/status/:sessionId (check status)
 * - KIOSK: POST /api/payment/cancel/:sessionId (cancel payment)
 * 
 * Uses switchable payment service (Mock or Datacap based on MOCK_PAYMENT_MODE)
 */

const express = require('express');
const router = express.Router();
const { PaymentSession } = require('../models');
const paymentService = require('../services/paymentService'); // Switchable service
const { ValidationError } = require('../middleware/errorHandler');

// Logger with payment-specific logging
let logger = null;
let logPaymentSession = null;

try {
  const loggerModule = require('../utils/logger');
  logger = loggerModule.logger;
  logPaymentSession = loggerModule.logPaymentSession;
} catch (error) {
  // Fallback logger if enhanced logger not available
  logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    payment: (msg, meta) => console.log('[PAYMENT]', msg, meta)
  };
  logPaymentSession = {
    created: (sessionId, amount, orderData) => console.log(`[PAYMENT] SESSION_CREATED: ${sessionId} amount:$${amount}`),
    initiated: (sessionId, amount) => console.log(`[PAYMENT] PAYMENT_INITIATED: ${sessionId}`),
    approved: (sessionId, transactionId, processingTimeMs) => console.log(`[PAYMENT] PAYMENT_APPROVED: ${sessionId} tx:${transactionId}`),
    declined: (sessionId, reason, responseCode) => console.log(`[PAYMENT] PAYMENT_DECLINED: ${sessionId} reason:${reason}`),
    failed: (sessionId, error, errorDetails) => console.log(`[PAYMENT] PAYMENT_FAILED: ${sessionId} error:${error}`),
    timeout: (sessionId, timeoutMs) => console.log(`[PAYMENT] PAYMENT_TIMEOUT: ${sessionId}`),
    cancelled: (sessionId, reason) => console.log(`[PAYMENT] PAYMENT_CANCELLED: ${sessionId}`),
    orderCreated: (sessionId, orderId, orderNumber) => console.log(`[PAYMENT] ORDER_CREATED: ${sessionId} order:${orderNumber}`),
    retry: (sessionId, attemptNumber, previousError) => console.log(`[PAYMENT] PAYMENT_RETRY: ${sessionId} attempt:${attemptNumber}`)
  };
}

// Helper: Generate unique session ID
const generateSessionId = () => {
  return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper: Calculate session expiry
const getSessionExpiry = () => {
  const timeoutMs = parseInt(process.env.PAYMENT_SESSION_TIMEOUT_MS) || 300000;
  return new Date(Date.now() + timeoutMs);
};

// Helper: Store Datacap transaction data on payment session
const storeTransactionData = (session, paymentResult) => {
  if (paymentResult.authCode) session.authCode = paymentResult.authCode;
  if (paymentResult.refNo) session.refNo = paymentResult.refNo;
  if (paymentResult.invoiceNo) session.invoiceNo = paymentResult.invoiceNo;
  if (paymentResult.acqRefData) session.acqRefData = paymentResult.acqRefData;
  if (paymentResult.processData) session.processData = paymentResult.processData;
  if (paymentResult.message) session.paymentMessage = paymentResult.message;
  if (paymentResult.responseCode) session.responseCode = paymentResult.responseCode;
};

// ==================== MOCK TEST ROUTES (for testing only) ====================

/**
 * POST /api/payment/test/approve
 * Test endpoint - Simulate approved payment (only works in mock mode)
 */
router.post('/test/approve', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { amount, orderData } = req.body;
    const sessionId = generateSessionId();
    const expiry = getSessionExpiry();
    
    logPaymentSession.created(sessionId, amount, orderData);
    
    const session = new PaymentSession({
      sessionId,
      orderData: orderData || {},
      status: 'pending',
      amount: amount || 0,
      expiresAt: expiry
    });
    await session.save();
    
    logPaymentSession.initiated(sessionId, amount);
    
    // Use the switchable payment service
    const result = await paymentService.processPayment(sessionId, amount, orderData);
    
    session.status = result.status;
    session.datacapTransactionId = result.transactionId;
    session.datacapResponse = result;
    session.completedAt = new Date();
    storeTransactionData(session, result);
    await session.save();
    
    const processingTime = Date.now() - startTime;
    
    if (result.status === 'approved') {
      logPaymentSession.approved(sessionId, result.transactionId, processingTime);
    } else {
      logPaymentSession.declined(sessionId, result.message, result.responseCode);
    }
    
    res.json({
      success: result.status === 'approved',
      sessionId,
      payment: result
    });
  } catch (error) {
    logPaymentSession.failed(req.body?.sessionId || 'unknown', error.message, error.stack);
    next(error);
  }
});

/**
 * POST /api/payment/test/decline
 * Test endpoint - Simulate declined payment (only works in mock mode)
 */
router.post('/test/decline', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { amount, orderData } = req.body;
    const sessionId = generateSessionId();
    const expiry = getSessionExpiry();
    
    // Force decline by adding test trigger
    const testOrderData = {
      ...(orderData || {}),
      testTrigger: 'decline'
    };
    
    logPaymentSession.created(sessionId, amount, testOrderData);
    
    const session = new PaymentSession({
      sessionId,
      orderData: testOrderData,
      status: 'pending',
      amount: amount || 0,
      expiresAt: expiry
    });
    await session.save();
    
    logPaymentSession.initiated(sessionId, amount);
    
    const result = await paymentService.processPayment(sessionId, amount, testOrderData);
    
    session.status = result.status;
    session.datacapTransactionId = result.transactionId;
    session.datacapResponse = result;
    session.completedAt = new Date();
    storeTransactionData(session, result);
    await session.save();
    
    const processingTime = Date.now() - startTime;
    logPaymentSession.declined(sessionId, result.message, result.responseCode);
    
    res.json({
      success: false,
      sessionId,
      payment: result
    });
  } catch (error) {
    logPaymentSession.failed(req.body?.sessionId || 'unknown', error.message, error.stack);
    next(error);
  }
});

/**
 * POST /api/payment/test/timeout
 * Test endpoint - Simulate payment timeout (only works in mock mode)
 */
router.post('/test/timeout', async (req, res, next) => {
  try {
    const { amount, orderData } = req.body;
    const sessionId = generateSessionId();
    const expiry = getSessionExpiry();
    
    logPaymentSession.created(sessionId, amount, orderData);
    
    const session = new PaymentSession({
      sessionId,
      orderData: orderData || {},
      status: 'pending',
      amount: amount || 0,
      expiresAt: expiry
    });
    await session.save();
    
    res.json({
      success: true,
      sessionId,
      message: 'Payment initiated (will timeout)',
      note: 'Frontend should handle timeout after 90 seconds'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payment/test/delayed
 * Test endpoint - Simulate delayed response (only works in mock mode)
 */
router.post('/test/delayed', async (req, res, next) => {
  try {
    const { amount, orderData, delayMs = 30000 } = req.body;
    const sessionId = generateSessionId();
    const expiry = getSessionExpiry();
    
    logPaymentSession.created(sessionId, amount, orderData);
    
    const session = new PaymentSession({
      sessionId,
      orderData: orderData || {},
      status: 'processing',
      amount: amount || 0,
      expiresAt: expiry
    });
    await session.save();
    
    // Process in background (only works if paymentService has this method)
    if (paymentService.processDelayedPayment) {
      paymentService.processDelayedPayment(sessionId, amount, delayMs)
        .then(async (result) => {
          session.status = result.status;
          session.datacapTransactionId = result.transactionId;
          session.datacapResponse = result;
          session.completedAt = new Date();
          storeTransactionData(session, result);
          await session.save();
          
          if (result.status === 'approved') {
            logPaymentSession.approved(sessionId, result.transactionId, delayMs);
          } else {
            logPaymentSession.declined(sessionId, result.message, result.responseCode);
          }
        })
        .catch(async (error) => {
          session.status = 'failed';
          session.errorMessage = error.message;
          await session.save();
          logPaymentSession.failed(sessionId, error.message, error.stack);
        });
    }
    
    res.json({
      success: true,
      sessionId,
      message: `Payment initiated with ${delayMs}ms delay`,
      estimatedCompletion: new Date(Date.now() + delayMs).toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ==================== MAIN PAYMENT ROUTES ====================

/**
 * POST /api/payment/initiate
 * Start a new payment session
 * 
 * Body:
 * {
 *   amount: number,
 *   orderData: object
 * }
 */
router.post('/initiate', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { amount, orderData } = req.body;
    
    if (!amount || amount <= 0) {
      throw new ValidationError('Valid amount is required');
    }
    
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      throw new ValidationError('Order data is required');
    }
    
    const sessionId = generateSessionId();
    const expiry = getSessionExpiry();
    
    const session = new PaymentSession({
      sessionId,
      orderData,
      status: 'pending',
      amount,
      expiresAt: expiry
    });
    await session.save();
    
    logPaymentSession.created(sessionId, amount, orderData);
    logger.info(`Payment session created: ${sessionId}, amount: $${amount}`);
    
    // Process payment (async - don't wait for full completion)
    // This allows for polling pattern
    paymentService.processPayment(sessionId, amount, orderData)
      .then(async (result) => {
        session.status = result.status;
        session.datacapTransactionId = result.transactionId;
        session.datacapResponse = result;
        session.completedAt = new Date();
        storeTransactionData(session, result);
        await session.save();
        
        const processingTime = Date.now() - startTime;
        
        if (result.status === 'approved') {
          logPaymentSession.approved(sessionId, result.transactionId, processingTime);
          logger.info(`Payment completed for session ${sessionId}: ${result.status} (${processingTime}ms)`);
        } else if (result.status === 'declined') {
          logPaymentSession.declined(sessionId, result.message, result.responseCode);
          logger.warn(`Payment declined for session ${sessionId}: ${result.message}`);
        } else {
          logPaymentSession.failed(sessionId, result.message, null);
          logger.error(`Payment failed for session ${sessionId}: ${result.message}`);
        }
      })
      .catch(async (error) => {
        session.status = 'failed';
        session.errorMessage = error.message;
        await session.save();
        logPaymentSession.failed(sessionId, error.message, error.stack);
        logger.error(`Payment failed for session ${sessionId}:`, error.message);
      });
    
    res.json({
      success: true,
      sessionId,
      status: 'pending',
      expiresAt: expiry,
      message: 'Payment initiated. Poll /status for result.'
    });
  } catch (error) {
    logPaymentSession.failed('unknown', error.message, error.stack);
    next(error);
  }
});

/**
 * GET /api/payment/status/:sessionId
 * Check payment status (polling endpoint)
 */
router.get('/status/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    const session = await PaymentSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Payment session not found'
      });
    }
    
    // Check if session expired
    if (session.expiresAt < new Date() && session.status === 'pending') {
      session.status = 'timeout';
      await session.save();
      logPaymentSession.timeout(sessionId, parseInt(process.env.PAYMENT_SESSION_TIMEOUT_MS) || 300000);
    }
    
    const isComplete = ['approved', 'declined', 'failed', 'timeout', 'cancelled'].includes(session.status);
    
    // Include additional transaction data for approved payments
    const responseData = {
      success: true,
      sessionId: session.sessionId,
      status: session.status,
      isComplete,
      amount: session.amount,
      transactionId: session.datacapTransactionId,
      errorMessage: session.errorMessage,
      expiresAt: session.expiresAt,
      completedAt: session.completedAt
    };
    
    // Add extra fields for approved transactions (useful for refunds)
    if (session.status === 'approved') {
      responseData.authCode = session.authCode;
      responseData.refNo = session.refNo;
      responseData.invoiceNo = session.invoiceNo;
      responseData.acqRefData = session.acqRefData;
      responseData.processData = session.processData;
    }
    
    res.json(responseData);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payment/cancel/:sessionId
 * Cancel an ongoing payment session
 */
router.post('/cancel/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    const session = await PaymentSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Payment session not found'
      });
    }
    
    if (session.status !== 'pending' && session.status !== 'processing') {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel payment in status: ${session.status}`
      });
    }
    
    const previousStatus = session.status;
    session.status = 'cancelled';
    session.completedAt = new Date();
    await session.save();
    
    logPaymentSession.cancelled(sessionId, `Cancelled from ${previousStatus} status`);
    logger.info(`Payment session cancelled: ${sessionId} (was ${previousStatus})`);
    
    res.json({
      success: true,
      message: 'Payment cancelled',
      sessionId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payment/refund/:sessionId
 * Refund/void a previously approved payment
 * Requires the original payment session data
 */
router.post('/refund/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    const originalSession = await PaymentSession.findOne({ sessionId });
    if (!originalSession) {
      return res.status(404).json({
        success: false,
        error: 'Payment session not found'
      });
    }
    
    if (originalSession.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: `Cannot refund payment in status: ${originalSession.status}. Only approved payments can be refunded.`
      });
    }
    
    if (!originalSession.datacapTransactionId) {
      return res.status(400).json({
        success: false,
        error: 'No transaction ID found for this payment'
      });
    }
    
    logger.info(`Processing refund for session: ${sessionId}, amount: $${originalSession.amount}`);
    
    // Use the payment service to void the sale
    if (paymentService.voidSale) {
      const voidResult = await paymentService.voidSale(
        {
          RecordNo: originalSession.datacapTransactionId,
          AuthCode: originalSession.authCode,
          RefNo: originalSession.refNo,
          InvoiceNo: originalSession.invoiceNo,
          AcqRefData: originalSession.acqRefData,
          ProcessData: originalSession.processData,
        },
        originalSession.amount,
        sessionId
      );
      
      if (voidResult.success) {
        // Create a refund record (optional - can add Refund model)
        logger.info(`Refund successful for session: ${sessionId}`);
        
        res.json({
          success: true,
          message: 'Refund processed successfully',
          refund: voidResult
        });
      } else {
        res.status(400).json({
          success: false,
          error: voidResult.message || 'Refund failed'
        });
      }
    } else {
      res.status(501).json({
        success: false,
        error: 'Refund not supported by current payment service'
      });
    }
  } catch (error) {
    logger.error(`Refund failed for session ${req.params.sessionId}:`, error);
    next(error);
  }
});

/**
 * GET /api/payment/health
 * Check payment service health
 */
router.get('/health', async (req, res) => {
  const serviceConfig = paymentService.getConfig ? paymentService.getConfig() : { mockMode: true };
  res.json({
    service: 'payment',
    mockMode: paymentService.isMockMode ? paymentService.isMockMode() : true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: serviceConfig
  });
});

module.exports = router;