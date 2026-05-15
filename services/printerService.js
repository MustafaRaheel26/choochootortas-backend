/**
 * Printer Service - Cloud Backend to Local Bridge
 * 
 * This service runs on your Render backend and:
 * 1. Receives order creation events
 * 2. Sends print jobs to local bridge service
 * 3. Doesn't block order response (async)
 * 4. Handles bridge offline scenarios
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

class PrinterService {
  constructor() {
    // Bridge service configuration from environment variables
    this.bridgeUrl = process.env.PRINTER_BRIDGE_URL || 'http://localhost:3001';
    this.apiKey = process.env.PRINTER_BRIDGE_API_KEY || 'dev-bridge-key-12345';
    
    // Debug: Check environment variable
    const envValue = process.env.ENABLE_PRINTING;
    console.log('🔍 DEBUG - Raw ENABLE_PRINTING from env:', JSON.stringify(envValue));
    console.log('🔍 DEBUG - Type of ENABLE_PRINTING:', typeof envValue);
    
    // Convert string 'true' to boolean true
    if (envValue === 'true' || envValue === 'True' || envValue === 'TRUE' || envValue === true) {
      this.enabled = true;
    } else {
      this.enabled = false;
    }
    
    this.timeout = parseInt(process.env.PRINT_TIMEOUT_MS) || 5000;
    
    console.log('🔍 DEBUG - Final enabled value:', this.enabled);
    
    logger.info(`Printer Service initialized:`, {
      enabled: this.enabled,
      bridgeUrl: this.bridgeUrl,
      timeout: this.timeout
    });
  }

  /**
   * Send order to kitchen and bar printers
   * This is called after order is saved to database
   */
  async sendOrderToPrinters(orderData) {
    if (!this.enabled) {
      logger.info('Printing is disabled (ENABLE_PRINTING=false)');
      return { success: false, reason: 'disabled' };
    }

    if (!orderData || !orderData.orderNumber) {
      logger.error('Invalid order data for printing');
      return { success: false, reason: 'invalid order data' };
    }

    logger.info(`Sending order #${orderData.orderNumber} to printers`, {
      orderType: orderData.orderType,
      itemCount: orderData.items?.length || 0
    });

    const results = {
      kitchen: null,
      bar: null,
      orderNumber: orderData.orderNumber,
      timestamp: new Date().toISOString()
    };

    // Send to both printers in parallel (don't wait for response)
    const printPromises = [];

    // Kitchen printer
    printPromises.push(
      this.sendToPrinter('kitchen', orderData)
        .then(result => { 
          results.kitchen = result; 
          logger.info(`✅ Kitchen printer result for order #${orderData.orderNumber}:`, result);
        })
        .catch(error => { 
          results.kitchen = { success: false, error: error.message };
          logger.error(`❌ Kitchen printer failed for order #${orderData.orderNumber}:`, error.message);
        })
    );

    // Bar printer
    printPromises.push(
      this.sendToPrinter('bar', orderData)
        .then(result => { 
          results.bar = result;
          logger.info(`✅ Bar printer result for order #${orderData.orderNumber}:`, result);
        })
        .catch(error => { 
          results.bar = { success: false, error: error.message };
          logger.error(`❌ Bar printer failed for order #${orderData.orderNumber}:`, error.message);
        })
    );

    // Wait for both to complete (or fail)
    await Promise.allSettled(printPromises);

    const anySuccess = results.kitchen?.success || results.bar?.success;
    logger.info(`Print job completed for order #${orderData.orderNumber}`, {
      kitchenSuccess: results.kitchen?.success || false,
      barSuccess: results.bar?.success || false
    });

    return results;
  }

  /**
   * Send print job to specific printer via bridge
   */
  async sendToPrinter(printer, orderData) {
    // Prepare payload for bridge service
    const payload = {
      printer: printer,
      orderData: {
        orderNumber: orderData.orderNumber,
        orderType: orderData.orderType,
        items: orderData.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          removed: item.removed || [],
          extras: item.extras || []
        })),
        notes: orderData.notes || ''
      }
    };

    try {
      logger.debug(`Sending print job to ${printer} printer via bridge`, {
        url: `${this.bridgeUrl}/print`,
        orderNumber: orderData.orderNumber
      });

      const response = await axios.post(`${this.bridgeUrl}/print`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        timeout: this.timeout
      });

      if (response.data && response.data.success) {
        logger.info(`✅ ${printer} printer job queued`, { 
          jobId: response.data.jobId,
          orderNumber: orderData.orderNumber
        });
        return { 
          success: true, 
          jobId: response.data.jobId,
          message: response.data.message
        };
      } else {
        throw new Error(response.data?.error || 'Unknown error from bridge');
      }

    } catch (error) {
      // Handle different error types
      if (error.code === 'ECONNREFUSED') {
        logger.error(`❌ Cannot reach bridge service for ${printer} printer`, {
          bridgeUrl: this.bridgeUrl,
          error: 'Connection refused - is the bridge service running?'
        });
        throw new Error(`Bridge service unreachable at ${this.bridgeUrl}`);
      } else if (error.code === 'ENOTFOUND') {
        logger.error(`❌ Cannot resolve bridge URL for ${printer} printer`, {
          bridgeUrl: this.bridgeUrl,
          error: 'DNS lookup failed'
        });
        throw new Error(`Cannot resolve bridge URL: ${this.bridgeUrl}`);
      } else if (error.response) {
        // Bridge responded with error status
        const errorMsg = error.response.data?.error || error.response.statusText;
        logger.error(`❌ Bridge returned error for ${printer} printer`, {
          status: error.response.status,
          error: errorMsg
        });
        throw new Error(`Bridge error: ${errorMsg}`);
      } else if (error.request) {
        // Request made but no response
        logger.error(`❌ No response from bridge for ${printer} printer`, {
          error: error.message
        });
        throw new Error(`No response from bridge service (timeout or network issue)`);
      } else {
        // Other errors
        logger.error(`❌ Failed to send to ${printer} printer`, {
          error: error.message
        });
        throw error;
      }
    }
  }

  /**
   * Test connection to bridge service
   * Used for debugging and health checks
   */
  async testConnection() {
    if (!this.enabled) {
      return {
        connected: false,
        reason: 'Printing is disabled (ENABLE_PRINTING=false)',
        bridgeUrl: this.bridgeUrl
      };
    }

    try {
      logger.info('Testing connection to bridge service...', { url: `${this.bridgeUrl}/health` });
      
      const response = await axios.get(`${this.bridgeUrl}/health`, {
        timeout: 3000,
        headers: {
          'X-API-Key': this.apiKey
        }
      });
      
      logger.info('✅ Bridge connection test successful', response.data);
      
      return {
        connected: true,
        bridgeUrl: this.bridgeUrl,
        bridgeStatus: response.data,
        printingEnabled: this.enabled
      };
    } catch (error) {
      logger.error('❌ Bridge connection test failed', {
        bridgeUrl: this.bridgeUrl,
        error: error.message
      });
      
      return {
        connected: false,
        bridgeUrl: this.bridgeUrl,
        error: error.message,
        printingEnabled: this.enabled
      };
    }
  }

  /**
   * Get printer configuration (for debugging)
   */
  getConfig() {
    return {
      enabled: this.enabled,
      bridgeUrl: this.bridgeUrl,
      timeout: this.timeout,
      hasApiKey: !!this.apiKey
    };
  }
}

// Singleton instance
const printerService = new PrinterService();

module.exports = { printerService };