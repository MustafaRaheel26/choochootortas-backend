/**
 * Settings Routes - MongoDB Version with Printer Status
 * 
 * Used by:
 * - ADMIN: GET, PUT (manage restaurant settings)
 * - KIOSK: GET (read tax rate for cart calculation)
 * - ADMIN: GET printer status and test prints
 * 
 * Note: PUT requires authentication (admin only)
 */

const express = require('express');
const router = express.Router();
const { Settings } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');
const axios = require('axios');

// Logger
let logger = null;
try {
  logger = require('../utils/logger').logger;
} catch (error) {
  logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args)
  };
}

// Helper: Get or create default settings
const getOrCreateSettings = async () => {
  let settings = await Settings.findOne({ id: 'settings_1' });
  if (!settings) {
    settings = new Settings({
      id: 'settings_1',
      name: 'Choo Choo Tortas',
      address: '123 Railway Ave, Flavor Town, FT 54321',
      phone: '(555) 123-4567',
      email: 'hello@choochootortas.com',
      taxRate: 8.25,
      currency: 'USD',
      currencySymbol: '$',
    });
    await settings.save();
  }
  return settings;
};

// Helper: Get currency symbol
const getCurrencySymbol = (currency) => {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    MXN: '$',
    CAD: '$',
  };
  return symbols[currency] || '$';
};

// Debug: Check if Settings is loaded
console.log('🔍 routes/settings.js - Settings model loaded:', typeof Settings === 'function' ? '✅' : '❌');

// Bridge configuration
const BRIDGE_URL = process.env.PRINTER_BRIDGE_URL || 'http://localhost:3001';
const BRIDGE_API_KEY = process.env.PRINTER_BRIDGE_API_KEY || 'dev-bridge-key-12345';

// ==================== PUBLIC GET ROUTES ====================

/**
 * GET /api/settings
 * Get restaurant settings
 * Used by: ADMIN, KIOSK (for tax calculation)
 */
router.get('/', async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/tax
 * Get tax rate only (lightweight endpoint for kiosk)
 * Used by: KIOSK (for cart total calculation)
 */
router.get('/tax', async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({
      success: true,
      data: {
        taxRate: settings.taxRate,
        currencySymbol: settings.currencySymbol,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PRINTER STATUS ROUTES ====================

/**
 * GET /api/settings/printer-status
 * Get current printer status from bridge
 * Used by: ADMIN (Settings page)
 */
router.get('/printer-status', authenticateToken, async (req, res, next) => {
  try {
    const printingEnabled = process.env.ENABLE_PRINTING === 'true';
    
    if (!printingEnabled) {
      return res.json({
        success: true,
        data: {
          printingEnabled: false,
          message: 'Printing is disabled in configuration',
          bridgeConnected: false,
          printers: {
            kitchen: { status: 'disabled', error: null },
            bar: { status: 'disabled', error: null },
            customer: { status: 'disabled', error: null }
          }
        }
      });
    }

    // Try to get status from bridge
    let bridgeStatus = null;
    let bridgeConnected = false;
    
    try {
      const response = await axios.get(`${BRIDGE_URL}/health`, {
        timeout: 3000,
        headers: { 'X-API-Key': BRIDGE_API_KEY }
      });
      bridgeStatus = response.data;
      bridgeConnected = true;
    } catch (error) {
      logger.warn('Bridge health check failed:', error.message);
    }

    res.json({
      success: true,
      data: {
        printingEnabled: true,
        bridgeConnected: bridgeConnected,
        bridgeUrl: BRIDGE_URL,
        printers: {
          kitchen: {
            status: bridgeStatus?.printers?.kitchen?.status || 'unknown',
            ip: bridgeStatus?.printers?.kitchen?.ip || '192.168.1.127',
            enabled: bridgeStatus?.printers?.kitchen?.enabled || false,
            error: bridgeStatus?.printers?.kitchen?.error || null
          },
          bar: {
            status: bridgeStatus?.printers?.bar?.status || 'unknown',
            ip: bridgeStatus?.printers?.bar?.ip || '192.168.1.136',
            enabled: bridgeStatus?.printers?.bar?.enabled || false,
            error: bridgeStatus?.printers?.bar?.error || null
          },
          customer: {
            status: bridgeStatus?.printers?.customer?.status || 'unknown',
            name: bridgeStatus?.printers?.customer?.name || 'USB Receipt Printer',
            enabled: bridgeStatus?.printers?.customer?.enabled || false,
            error: bridgeStatus?.printers?.customer?.error || null
          }
        },
        lastPoll: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get printer status:', error);
    res.json({
      success: true,
      data: {
        printingEnabled: true,
        bridgeConnected: false,
        bridgeUrl: BRIDGE_URL,
        error: error.message,
        printers: {
          kitchen: { status: 'error', error: error.message },
          bar: { status: 'error', error: error.message },
          customer: { status: 'error', error: error.message }
        }
      }
    });
  }
});

/**
 * POST /api/settings/printer-test
 * Send test print to specific printer
 * Used by: ADMIN (Settings page - Test buttons)
 */
router.post('/printer-test', authenticateToken, async (req, res, next) => {
  try {
    const { printer } = req.body;
    
    if (!printer || !['kitchen', 'bar', 'customer'].includes(printer)) {
      throw new ValidationError('Invalid printer. Must be kitchen, bar, or customer');
    }
    
    const printingEnabled = process.env.ENABLE_PRINTING === 'true';
    if (!printingEnabled) {
      return res.status(400).json({
        success: false,
        error: 'Printing is disabled in configuration'
      });
    }

    const testOrder = {
      printer: printer,
      orderData: {
        orderNumber: 'TEST',
        orderType: 'test',
        items: [
          {
            name: 'TEST PRINT',
            quantity: 1,
            price: 0,
            removed: [],
            extras: [`Test print from Admin - ${new Date().toLocaleString()}`]
          }
        ],
        notes: 'If you see this, printer is working correctly!'
      }
    };

    // For customer receipt, add price fields
    if (printer === 'customer') {
      testOrder.orderData.subtotal = 0;
      testOrder.orderData.tax = 0;
      testOrder.orderData.totalPrice = 0;
      testOrder.orderData.timestamp = new Date().toISOString();
    }

    const response = await axios.post(`${BRIDGE_URL}/print`, testOrder, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': BRIDGE_API_KEY
      },
      timeout: 10000
    });

    if (response.data && response.data.success) {
      logger.info(`Test print sent to ${printer} printer`);
      res.json({
        success: true,
        message: `Test print sent to ${printer} printer`,
        jobId: response.data.jobId
      });
    } else {
      throw new Error(response.data?.error || 'Unknown error');
    }
  } catch (error) {
    logger.error(`Test print failed for ${req.body.printer}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send test print'
    });
  }
});

// ==================== PROTECTED ROUTES ====================

/**
 * PUT /api/settings
 * Update restaurant settings
 * Used by: ADMIN
 */
router.put('/', authenticateToken, async (req, res, next) => {
  try {
    const updates = req.body;
    
    console.log('📝 PUT /settings - Request received');
    console.log('📝 Updates:', JSON.stringify(updates, null, 2));
    console.log('📝 User from token:', req.user);
    
    let settings = await getOrCreateSettings();
    
    // Validate tax rate if provided
    if (updates.taxRate !== undefined) {
      const taxRate = Number(updates.taxRate);
      if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
        throw new ValidationError('Tax rate must be between 0 and 100');
      }
      settings.taxRate = taxRate;
      console.log('📝 Updating tax rate to:', taxRate);
    }
    
    // Validate currency if provided
    if (updates.currency !== undefined) {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'MXN', 'CAD'];
      if (!validCurrencies.includes(updates.currency)) {
        throw new ValidationError(`Currency must be one of: ${validCurrencies.join(', ')}`);
      }
      settings.currency = updates.currency;
      settings.currencySymbol = getCurrencySymbol(updates.currency);
      console.log('📝 Updating currency to:', updates.currency);
    }
    
    // Update other fields
    if (updates.name !== undefined) settings.name = updates.name;
    if (updates.address !== undefined) settings.address = updates.address;
    if (updates.phone !== undefined) settings.phone = updates.phone;
    if (updates.email !== undefined) settings.email = updates.email;
    
    await settings.save();
    
    console.log('✅ Settings updated successfully');
    console.log('📤 New settings:', JSON.stringify(settings, null, 2));
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings,
    });
  } catch (error) {
    console.log('❌ Error in PUT /settings:', error.message);
    next(error);
  }
});

module.exports = router;