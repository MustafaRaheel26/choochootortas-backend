/**
 * Models Index - Export all MongoDB models
 * THIS FILE IS CRITICAL - It must export all models correctly
 */

const Order = require('./Order');
const MenuItem = require('./MenuItem');
const Category = require('./Category');
const Settings = require('./Settings');
const PaymentSession = require('./PaymentSession');

// Log to verify models are loaded
console.log('📦 Models loaded successfully:');
console.log('   - Order:', typeof Order === 'function' ? '✅' : '❌');
console.log('   - MenuItem:', typeof MenuItem === 'function' ? '✅' : '❌');
console.log('   - Category:', typeof Category === 'function' ? '✅' : '❌');
console.log('   - Settings:', typeof Settings === 'function' ? '✅' : '❌');
console.log('   - PaymentSession:', typeof PaymentSession === 'function' ? '✅' : '❌');

module.exports = {
  Order,
  MenuItem,
  Category,
  Settings,
  PaymentSession,
};