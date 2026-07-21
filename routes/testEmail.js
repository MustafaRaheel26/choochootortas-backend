/**
 * Test Email Route - For debugging SMTP
 */

const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

router.get('/', async (req, res) => {
  try {
    const testOrder = {
      id: 'order_TEST',
      items: [
        { name: 'Test Item 1', quantity: 1, price: 10.00, removed: [], extras: [] },
        { name: 'Test Item 2', quantity: 2, price: 5.50, removed: ['onions'], extras: ['cheese'] }
      ],
      subtotal: 21.00,
      tax: 1.73,
      totalPrice: 22.73,
      createdAt: new Date(),
      orderType: 'eat-in',
      customerEmail: 'mustafaraheel26@gmail.com',
      receiptPreference: 'email'
    };
    
    console.log('Testing email service...');
    const result = await emailService.sendReceiptEmail(testOrder);
    
    res.json({
      success: true,
      message: 'Email test completed',
      result: result
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;