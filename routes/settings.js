/**
 * Settings Routes - MongoDB Version
 * 
 * Used by:
 * - ADMIN: GET, PUT (manage restaurant settings)
 * - KIOSK: GET (read tax rate for cart calculation)
 * 
 * Note: PUT requires authentication (admin only)
 */

const express = require('express');
const router = express.Router();
const { Settings } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

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
    
    // No need to manually set updatedAt – timestamps plugin handles it
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