/**
 * Datacap DC Direct HTTP Client
 * 
 * Handles HTTPS POST requests to Datacap cloud with Basic Auth
 * Supports both XML and JSON formats (using XML as primary)
 */

const axios = require('axios');
const crypto = require('crypto');
const { logger, logPaymentSession } = require('../utils/logger');
const datacapConfig = require('../config/datacap');
const { parseXml, flattenResponse } = require('../utils/xmlParser');

class DatacapHttpClient {
  constructor() {
    this.config = datacapConfig;
    this.authHeader = null;
  }

  /**
   * Build Basic Authentication header
   */
  getAuthHeader() {
    if (this.authHeader) return this.authHeader;
    
    const credentials = `${this.config.accountId}:${this.config.authCode}`;
    const encoded = Buffer.from(credentials).toString('base64');
    this.authHeader = `Basic ${encoded}`;
    return this.authHeader;
  }

  /**
   * Get headers for request
   */
  getHeaders(contentType = 'application/xml') {
    return {
      'Content-Type': contentType,
      'Authorization': this.getAuthHeader(),
    };
  }

  /**
   * Send XML request and wait for response
   * Handles "In Process with Device" retry logic
   */
  async sendXmlRequest(xmlBody, retryCount = 0) {
    const startTime = Date.now();
    
    try {
      logger.debug(`[Datacap] Sending XML request (attempt ${retryCount + 1})`);
      
      const response = await axios.post(this.config.activeEndpoint, xmlBody, {
        headers: this.getHeaders('application/xml'),
        timeout: this.config.requestTimeoutMs,
      });

      const parsedResponse = await this.parseXmlResponse(response.data);
      const textResponse = (parsedResponse.TextResponse || '').toLowerCase();
      
      // Check for "In Process with Device"
      if (textResponse.includes('in process') && retryCount < this.config.inProcessMaxRetries) {
        logger.info(`[Datacap] Device in process, retrying in ${this.config.inProcessRetryDelaySec}s (attempt ${retryCount + 1}/${this.config.inProcessMaxRetries})`);
        await this.delay(this.config.inProcessRetryDelaySec * 1000);
        return this.sendXmlRequest(xmlBody, retryCount + 1);
      }
      
      const elapsed = Date.now() - startTime;
      logger.debug(`[Datacap] Response received in ${elapsed}ms`);
      
      return parsedResponse;
      
    } catch (error) {
      logger.error(`[Datacap] Request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse XML response from Datacap using xmlParser utility
   */
  async parseXmlResponse(xmlText) {
    try {
      const parsed = await parseXml(xmlText);
      const flattened = flattenResponse(parsed);
      
      // Return consistent response object
      return {
        CmdStatus: flattened.CmdStatus || '',
        TextResponse: flattened.TextResponse || '',
        SequenceNo: flattened.SequenceNo || '',
        RecordNo: flattened.RecordNo || '',
        AuthCode: flattened.AuthCode || '',
        RefNo: flattened.RefNo || '',
        InvoiceNo: flattened.InvoiceNo || '',
        Purchase: flattened.Purchase || '',
        Authorize: flattened.Authorize || '',
        AcqRefData: flattened.AcqRefData || '',
        ProcessData: flattened.ProcessData || '',
        DSIXReturnCode: flattened.DSIXReturnCode || '',
        TranCode: flattened.TranCode || '',
        PostProcess: flattened.PostProcess || '',
        // Raw response for debugging
        _raw: xmlText,
        _parsed: parsed
      };
    } catch (error) {
      logger.error(`[Datacap] XML parsing error: ${error.message}`);
      // Fallback to regex parsing if xml2js fails
      return this.fallbackParseXmlResponse(xmlText);
    }
  }

  /**
   * Fallback XML parsing using regex (if xml2js fails)
   */
  fallbackParseXmlResponse(xmlText) {
    const result = {};
    
    const patterns = {
      CmdStatus: /<CmdStatus>([^<]+)<\/CmdStatus>/,
      TextResponse: /<TextResponse>([^<]+)<\/TextResponse>/,
      SequenceNo: /<SequenceNo>([^<]+)<\/SequenceNo>/,
      RecordNo: /<RecordNo>([^<]+)<\/RecordNo>/,
      AuthCode: /<AuthCode>([^<]+)<\/AuthCode>/,
      RefNo: /<RefNo>([^<]+)<\/RefNo>/,
      InvoiceNo: /<InvoiceNo>([^<]+)<\/InvoiceNo>/,
      Purchase: /<Purchase>([^<]+)<\/Purchase>/,
      Authorize: /<Authorize>([^<]+)<\/Authorize>/,
      AcqRefData: /<AcqRefData>([^<]+)<\/AcqRefData>/,
      ProcessData: /<ProcessData>([^<]+)<\/ProcessData>/,
      DSIXReturnCode: /<DSIXReturnCode>([^<]+)<\/DSIXReturnCode>/,
      TranCode: /<TranCode>([^<]+)<\/TranCode>/,
      PostProcess: /<PostProcess>([^<]+)<\/PostProcess>/,
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = xmlText.match(pattern);
      if (match) {
        result[key] = match[1];
      }
    }
    
    return result;
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if response is approved
   */
  isApproved(response) {
    const status = (response.CmdStatus || '').toLowerCase();
    return status === 'approved' || status === 'success';
  }

  /**
   * Check if response requires EMVParamDownload
   */
  requiresParamDownload(response) {
    return response.PostProcess === 'EMVParamDownloadRequired';
  }
}

module.exports = new DatacapHttpClient();