/**
 * Mock Payment Service - Simulates Datacap/NETePay behavior
 * 
 * Used for testing payment flow without real terminal
 * 
 * Simulates:
 * - Approved payment
 * - Declined payment  
 * - Timeout
 * - Delayed response
 * - Network latency
 * - Random processing times
 * - Backend unavailable
 * - Partial approval (first decline, then approve on retry)
 * - Slow network (intermittent delays)
 * 
 * When Datacap integration is ready, replace this service
 */

const { v4: uuidv4 } = require('uuid');

class MockPaymentService {
  constructor() {
    // Configuration
    this.mockMode = process.env.MOCK_PAYMENT_MODE === 'true' || true;
    
    // Realistic delays (min, max) for different scenarios
    this.minDelayMs = parseInt(process.env.MOCK_MIN_DELAY_MS) || 2000;
    this.maxDelayMs = parseInt(process.env.MOCK_MAX_DELAY_MS) || 8000;
    this.approvalRate = parseInt(process.env.MOCK_APPROVAL_RATE) || 80; // 80% approval rate
    this.timeoutRate = parseInt(process.env.MOCK_TIMEOUT_RATE) || 5; // 5% timeout rate
    this.networkErrorRate = parseInt(process.env.MOCK_NETWORK_ERROR_RATE) || 3; // 3% network error
    this.backendErrorRate = parseInt(process.env.MOCK_BACKEND_ERROR_RATE) || 2; // 2% backend error
    this.slowNetworkRate = parseInt(process.env.MOCK_SLOW_NETWORK_RATE) || 10; // 10% slow network
    this.partialApprovalRate = parseInt(process.env.MOCK_PARTIAL_APPROVAL_RATE) || 5; // 5% partial approval
    
    // Track retry attempts per session
    this.sessionAttempts = new Map();
    
    // Log configuration on startup
    console.log('[MockPayment] Configuration loaded:');
    console.log(`  - Min Delay: ${this.minDelayMs}ms`);
    console.log(`  - Max Delay: ${this.maxDelayMs}ms`);
    console.log(`  - Approval Rate: ${this.approvalRate}%`);
    console.log(`  - Timeout Rate: ${this.timeoutRate}%`);
    console.log(`  - Network Error Rate: ${this.networkErrorRate}%`);
    console.log(`  - Backend Error Rate: ${this.backendErrorRate}%`);
    console.log(`  - Slow Network Rate: ${this.slowNetworkRate}%`);
    console.log(`  - Partial Approval Rate: ${this.partialApprovalRate}%`);
  }

  /**
   * Get random delay between min and max
   */
  getRandomDelay() {
    return Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs + 1) + this.minDelayMs);
  }

  /**
   * Simulate network latency with realistic jitter
   */
  async simulateNetworkLatency() {
    // Check for slow network simulation
    const isSlowNetwork = Math.random() * 100 <= this.slowNetworkRate;
    
    let totalDelay = this.getRandomDelay();
    if (isSlowNetwork) {
      // Double the delay for slow network
      totalDelay = totalDelay * 2;
      console.log(`[MockPayment] SLOW NETWORK: ${Math.round(totalDelay)}ms delay`);
    } else {
      // Add jitter (random variation)
      const jitter = Math.random() * 500;
      totalDelay = totalDelay + jitter;
      console.log(`[MockPayment] Network latency: ${Math.round(totalDelay)}ms`);
    }
    
    await this.delay(totalDelay);
    return isSlowNetwork;
  }

  /**
   * Simulate payment processing with realistic behavior
   * Returns promise that resolves after variable delay
   */
  async processPayment(sessionId, amount, orderData) {
    const startTime = Date.now();
    console.log(`[MockPayment] Processing payment for session: ${sessionId}, amount: $${amount}`);
    
    // Get attempt count for this session
    const attemptCount = this.sessionAttempts.get(sessionId) || 0;
    this.sessionAttempts.set(sessionId, attemptCount + 1);
    console.log(`[MockPayment] Attempt #${attemptCount + 1} for session: ${sessionId}`);
    
    // Step 1: Simulate terminal connection
    console.log(`[MockPayment] Connecting to payment terminal...`);
    await this.delay(500);
    
    // Step 2: Simulate backend error (Datacap unavailable)
    const backendError = Math.random() * 100;
    if (backendError <= this.backendErrorRate && attemptCount === 0) {
      console.log(`[MockPayment] BACKEND ERROR simulation triggered for session: ${sessionId}`);
      throw new Error('BACKEND_ERROR: Payment processor unavailable. Please try again.');
    }
    
    // Step 3: Simulate random network error
    const networkError = Math.random() * 100;
    if (networkError <= this.networkErrorRate) {
      console.log(`[MockPayment] NETWORK ERROR simulation triggered for session: ${sessionId}`);
      throw new Error('NETWORK_ERROR: Connection lost to payment terminal');
    }
    
    // Step 4: Simulate terminal communication delay
    console.log(`[MockPayment] Communicating with terminal...`);
    await this.delay(800);
    
    // Step 5: Simulate random timeout
    const timeoutTrigger = Math.random() * 100;
    if (timeoutTrigger <= this.timeoutRate) {
      console.log(`[MockPayment] TIMEOUT simulation triggered for session: ${sessionId}`);
      throw new Error('TIMEOUT: No response from terminal after 30 seconds');
    }
    
    // Step 6: Simulate main processing with variable delay
    const wasSlow = await this.simulateNetworkLatency();
    
    // Step 7: Check for partial approval (first attempt fails, retry succeeds)
    const isPartialApproval = Math.random() * 100 <= this.partialApprovalRate && attemptCount === 0;
    
    if (isPartialApproval) {
      console.log(`[MockPayment] PARTIAL APPROVAL simulation: First attempt declined, retry will succeed`);
      return {
        success: false,
        status: 'declined',
        transactionId: uuidv4(),
        message: 'Issuer timeout - please try again',
        responseCode: 'DECLINED_99',
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        shouldRetry: true
      };
    }
    
    // Step 8: Determine payment result
    const result = this.determinePaymentResult(amount, orderData, attemptCount);
    
    const elapsed = Date.now() - startTime;
    console.log(`[MockPayment] Result: ${result.status} (took ${elapsed}ms)`);
    
    // Clean up session attempts
    this.sessionAttempts.delete(sessionId);
    
    return {
      success: result.status === 'approved',
      status: result.status,
      transactionId: result.transactionId,
      message: result.message,
      responseCode: result.responseCode,
      processingTimeMs: elapsed,
      timestamp: new Date().toISOString(),
      wasSlowNetwork: wasSlow
    };
  }

  /**
   * Determine payment result (approve/decline/timeout)
   */
  determinePaymentResult(amount, orderData, attemptCount) {
    const transactionId = uuidv4();
    
    // Check for special test triggers in orderData
    const testTrigger = orderData?.testTrigger || null;
    
    // Partial approval retry detection (second attempt should succeed)
    if (attemptCount > 0 && orderData?.isRetry === true) {
      console.log(`[MockPayment] Retry attempt detected, approving`);
      return {
        status: 'approved',
        transactionId,
        message: 'Approved (retry successful)',
        responseCode: 'APPROVED_00'
      };
    }
    
    switch (testTrigger) {
      case 'decline':
        return {
          status: 'declined',
          transactionId,
          message: 'Card declined by issuer',
          responseCode: 'DECLINED_05',
          declineReason: 'Issuer declined transaction'
        };
      case 'timeout':
        throw new Error('TIMEOUT: Payment terminal not responding');
      case 'delayed':
        return {
          status: 'approved',
          transactionId,
          message: 'Approved (delayed response)',
          responseCode: 'APPROVED_00'
        };
      case 'insufficient_funds':
        return {
          status: 'declined',
          transactionId,
          message: 'Insufficient funds',
          responseCode: 'DECLINED_51',
          declineReason: 'Card does not have sufficient funds'
        };
      case 'card_error':
        return {
          status: 'declined',
          transactionId,
          message: 'Card read error',
          responseCode: 'ERROR_99',
          declineReason: 'Unable to read card. Please try again.'
        };
      case 'partial_approval':
        if (attemptCount === 0) {
          return {
            status: 'declined',
            transactionId,
            message: 'Issuer timeout - please retry',
            responseCode: 'DECLINED_99',
            declineReason: 'Temporary issue, please try again'
          };
        } else {
          return {
            status: 'approved',
            transactionId,
            message: 'Approved (retry successful)',
            responseCode: 'APPROVED_00'
          };
        }
      default:
        // Random based on approval rate
        const random = Math.random() * 100;
        if (random <= this.approvalRate) {
          // Random approval message variations
          const approvalMessages = [
            'Approved',
            'Approved - Thank you',
            'Transaction approved',
            'Payment successful'
          ];
          const randomMessage = approvalMessages[Math.floor(Math.random() * approvalMessages.length)];
          return {
            status: 'approved',
            transactionId,
            message: randomMessage,
            responseCode: 'APPROVED_00'
          };
        } else {
          // Random decline reasons
          const declineReasons = [
            { message: 'Insufficient funds', code: 'DECLINED_51' },
            { message: 'Card declined by issuer', code: 'DECLINED_05' },
            { message: 'Card expired', code: 'DECLINED_54' },
            { message: 'Invalid PIN', code: 'DECLINED_55' },
            { message: 'Transaction not permitted', code: 'DECLINED_57' }
          ];
          const randomDecline = declineReasons[Math.floor(Math.random() * declineReasons.length)];
          return {
            status: 'declined',
            transactionId,
            message: randomDecline.message,
            responseCode: randomDecline.code,
            declineReason: randomDecline.message
          };
        }
    }
  }

  /**
   * Simulate delayed payment (for testing timeout handling)
   */
  async processDelayedPayment(sessionId, amount, delayMs = 120000) {
    console.log(`[MockPayment] Processing DELAYED payment for session: ${sessionId}, delay: ${delayMs}ms`);
    await this.delay(delayMs);
    
    return {
      success: true,
      status: 'approved',
      transactionId: uuidv4(),
      message: 'Approved (after delay)',
      responseCode: 'APPROVED_00',
      processingTimeMs: delayMs,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get payment status from Datacap (polling simulation)
   */
  async getPaymentStatus(transactionId) {
    await this.delay(500);
    
    return {
      transactionId,
      status: 'approved',
      message: 'Payment completed',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simulate card insertion/presentation
   */
  async waitForCard() {
    console.log(`[MockPayment] Waiting for card...`);
    // Simulate 1-3 seconds for card presentation
    await this.delay(Math.floor(Math.random() * 2000) + 1000);
    console.log(`[MockPayment] Card detected`);
  }

  /**
   * Simulate backend completely down (for testing)
   */
  async simulateBackendDown() {
    console.log(`[MockPayment] SIMULATING BACKEND DOWN`);
    throw new Error('BACKEND_UNAVAILABLE: Payment service is currently unavailable');
  }

  /**
   * Simulate network disconnect during payment
   */
  async simulateNetworkDisconnect() {
    console.log(`[MockPayment] SIMULATING NETWORK DISCONNECT`);
    // Simulate connection lost
    await this.delay(500);
    throw new Error('NETWORK_DISCONNECT: Connection to payment terminal lost');
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if mock mode is enabled
   */
  isMockMode() {
    return this.mockMode;
  }

  /**
   * Get service configuration (for debugging)
   */
  getConfig() {
    return {
      mockMode: this.mockMode,
      minDelayMs: this.minDelayMs,
      maxDelayMs: this.maxDelayMs,
      approvalRate: this.approvalRate,
      timeoutRate: this.timeoutRate,
      networkErrorRate: this.networkErrorRate,
      backendErrorRate: this.backendErrorRate,
      slowNetworkRate: this.slowNetworkRate,
      partialApprovalRate: this.partialApprovalRate
    };
  }
}

module.exports = new MockPaymentService();