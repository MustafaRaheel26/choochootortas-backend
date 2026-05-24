/**
 * Datacap DC Direct Payment Service
 * 
 * Replaces mockPaymentService.js
 * Implements server communication (HTTPS POST) to Datacap cloud
 * 
 * Transaction Flow:
 * 1. EMVParamDownload (only when required)
 * 2. EMVSale (main payment)
 * 3. EMVPadReset (after every transaction)
 * 4. VoidSaleByRecordNo (refund)
 */

const datacapHttpClient = require('./datacapHttpClient');
const datacapRequestBuilder = require('./datacapRequestBuilder');
const sequenceManager = require('./datacapSequenceManager');
const { logger, logPaymentSession } = require('../utils/logger');

class DatacapPaymentService {
  constructor() {
    this.mockMode = false; // Real Datacap mode
    this.emvParamDownloadCompleted = false;
    this.emvParamDownloadRequired = false;
  }

  /**
   * Initialize Datacap service
   * Check if EMVParamDownload is required
   */
  async initialize() {
    logger.info('[Datacap] Initializing Datacap Payment Service');
    logger.info(`[Datacap] Endpoint: ${process.env.DATACAP_ENDPOINT === 'prod' ? 'PRODUCTION' : 'CERTIFICATION'}`);
    logger.info(`[Datacap] Device ID: ${process.env.DATACAP_TRAN_DEVICE_ID || 'Not configured'}`);
    
    // Validate configuration
    if (!process.env.DATACAP_ACCOUNT_ID || !process.env.DATACAP_AUTH_CODE) {
      logger.error('[Datacap] Missing authentication credentials');
      throw new Error('Datacap credentials not configured');
    }
    
    if (!process.env.DATACAP_TRAN_DEVICE_ID) {
      logger.error('[Datacap] Missing TranDeviceID');
      throw new Error('Datacap TranDeviceID not configured');
    }
    
    logger.info('[Datacap] Service ready');
  }

  /**
   * Run EMVParamDownload (required for new device setup)
   */
  async runEmvParamDownload() {
    logger.info('[Datacap] Running EMVParamDownload...');
    
    const sequenceNo = sequenceManager.getCurrentSequence();
    const request = datacapRequestBuilder.buildEmvParamDownload(sequenceNo);
    
    logger.debug('[Datacap] Sending EMVParamDownload request');
    const response = await datacapHttpClient.sendXmlRequest(request);
    
    if (!datacapHttpClient.isApproved(response)) {
      logger.error(`[Datacap] EMVParamDownload failed: ${response.TextResponse}`);
      throw new Error(`EMVParamDownload failed: ${response.TextResponse}`);
    }
    
    // Update sequence number
    if (response.SequenceNo) {
      sequenceManager.updateSequence(response.SequenceNo);
    }
    
    this.emvParamDownloadCompleted = true;
    logger.info('[Datacap] EMVParamDownload successful');
    
    return response;
  }

  /**
   * Run EMVPadReset (required after every transaction)
   */
  async runEmvPadReset(context = 'transaction') {
    logger.info(`[Datacap] Running EMVPadReset after ${context}...`);
    
    const sequenceNo = sequenceManager.getCurrentSequence();
    const request = datacapRequestBuilder.buildEmvPadReset(sequenceNo, 'OPERATOR1', `reset_after_${context}`);
    
    const response = await datacapHttpClient.sendXmlRequest(request);
    
    if (!datacapHttpClient.isApproved(response)) {
      logger.warn(`[Datacap] EMVPadReset had issue: ${response.TextResponse}`);
      // Don't throw - pad reset can fail but still continue
    }
    
    // Update sequence number
    if (response.SequenceNo) {
      sequenceManager.updateSequence(response.SequenceNo);
    }
    
    logger.info('[Datacap] EMVPadReset completed');
    return response;
  }

  /**
   * Process EMVSale payment
   * This is the main payment method called from payment routes
   */
  async processPayment(sessionId, amount, orderData) {
    const startTime = Date.now();
    logger.info(`[Datacap] Processing payment for session: ${sessionId}, amount: $${amount}`);
    
    try {
      // Step 1: Check if EMVParamDownload is required
      if (this.emvParamDownloadRequired && !this.emvParamDownloadCompleted) {
        logger.info('[Datacap] EMVParamDownload required, running first...');
        await this.runEmvParamDownload();
        // Wait 2 minutes after param download as per Datacap recommendation
        logger.info('[Datacap] Waiting 2 minutes after EMVParamDownload...');
        await this.delay(120000);
      }
      
      // Step 2: Generate unique invoice and reference numbers
      const invoiceNo = `${Date.now()}`.slice(-8);
      const refNo = invoiceNo;
      
      // Step 3: Build and send EMVSale request
      const sequenceNo = sequenceManager.getCurrentSequence();
      const request = datacapRequestBuilder.buildEmvSale(
        sequenceNo,
        invoiceNo,
        refNo,
        amount.toFixed(2),
        true, // requestToken - needed for refunds
        null, // okAmount - let cardholder confirm on device
        'OPERATOR1',
        `sale_${sessionId.slice(-8)}`
      );
      
      logger.info('[Datacap] Sending EMVSale request, waiting for card...');
      const response = await datacapHttpClient.sendXmlRequest(request);
      
      // Step 4: Check response
      if (!datacapHttpClient.isApproved(response)) {
        logger.warn(`[Datacap] EMVSale declined: ${response.TextResponse}`);
        
        // Still run pad reset to clear device state
        await this.runEmvPadReset('declined_sale');
        
        return {
          success: false,
          status: 'declined',
          transactionId: response.RecordNo || null,
          message: response.TextResponse || 'Payment declined',
          responseCode: response.DSIXReturnCode || 'DECLINED',
          processingTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          details: {
            cmdStatus: response.CmdStatus,
            authCode: response.AuthCode,
            refNo: response.RefNo,
          }
        };
      }
      
      // Step 5: Update sequence number
      if (response.SequenceNo) {
        sequenceManager.updateSequence(response.SequenceNo);
      }
      
      // Step 6: Run EMVPadReset after successful transaction
      await this.runEmvPadReset('successful_sale');
      
      // Step 7: Check if processor requests param download for next time
      if (datacapHttpClient.requiresParamDownload(response)) {
        this.emvParamDownloadRequired = true;
        logger.info('[Datacap] Processor requested EMVParamDownload for next transaction');
      }
      
      const elapsed = Date.now() - startTime;
      logger.info(`[Datacap] EMVSale approved in ${elapsed}ms`);
      
      // Log payment approval
      logPaymentSession.approved(sessionId, response.RecordNo, elapsed);
      
      return {
        success: true,
        status: 'approved',
        transactionId: response.RecordNo,
        authCode: response.AuthCode,
        refNo: response.RefNo,
        invoiceNo: response.InvoiceNo,
        acqRefData: response.AcqRefData,
        processData: response.ProcessData,
        message: response.TextResponse || 'Approved',
        responseCode: 'APPROVED_00',
        processingTimeMs: elapsed,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      logger.error(`[Datacap] Payment failed: ${error.message}`);
      
      // Attempt pad reset to recover device
      try {
        await this.runEmvPadReset('error_recovery');
      } catch (resetError) {
        logger.error(`[Datacap] Pad reset after error failed: ${resetError.message}`);
      }
      
      return {
        success: false,
        status: 'failed',
        transactionId: null,
        message: error.message,
        responseCode: 'ERROR',
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Void a sale by RecordNo (refund)
   */
  async voidSale(saleResponse, amount, sessionId) {
    const startTime = Date.now();
    logger.info(`[Datacap] Voiding sale for session: ${sessionId}, amount: $${amount}`);
    
    try {
      // Validate required fields
      const required = ['RecordNo', 'AuthCode', 'RefNo', 'InvoiceNo', 'AcqRefData', 'ProcessData'];
      const missing = required.filter(field => !saleResponse[field]);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields for void: ${missing.join(', ')}`);
      }
      
      // Run EMVPadReset before void
      await this.runEmvPadReset('before_void');
      
      // Build and send void request
      const sequenceNo = sequenceManager.getCurrentSequence();
      const request = datacapRequestBuilder.buildVoidSaleByRecordNo(
        sequenceNo,
        saleResponse.InvoiceNo,
        saleResponse.RefNo,
        amount.toFixed(2),
        saleResponse.RecordNo,
        saleResponse.AuthCode,
        saleResponse.AcqRefData,
        saleResponse.ProcessData,
        'OPERATOR1',
        `void_${sessionId.slice(-8)}`
      );
      
      const response = await datacapHttpClient.sendXmlRequest(request);
      
      if (!datacapHttpClient.isApproved(response)) {
        logger.warn(`[Datacap] Void declined: ${response.TextResponse}`);
        return {
          success: false,
          status: 'declined',
          message: response.TextResponse || 'Void declined',
          processingTimeMs: Date.now() - startTime,
        };
      }
      
      // Update sequence number
      if (response.SequenceNo) {
        sequenceManager.updateSequence(response.SequenceNo);
      }
      
      // Run EMVPadReset after void
      await this.runEmvPadReset('after_void');
      
      logger.info(`[Datacap] Void approved`);
      
      return {
        success: true,
        status: 'approved',
        message: response.TextResponse || 'Void successful',
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      
    } catch (error) {
      logger.error(`[Datacap] Void failed: ${error.message}`);
      return {
        success: false,
        status: 'failed',
        message: error.message,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if mock mode is enabled (always false for real service)
   */
  isMockMode() {
    return false;
  }

  /**
   * Get service configuration
   */
  getConfig() {
    return {
      mockMode: false,
      service: 'Datacap DC Direct',
      endpoint: process.env.DATACAP_ENDPOINT === 'prod' ? 'PRODUCTION' : 'CERTIFICATION',
      deviceId: process.env.DATACAP_TRAN_DEVICE_ID ? 'configured' : 'missing',
    };
  }
}

module.exports = new DatacapPaymentService();