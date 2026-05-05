/**
 * Settings Model - MongoDB Schema
 * 
 * Matches the settings structure from:
 * - ADMIN (Settings page)
 * 
 * Includes: restaurant info, tax settings, currency, etc.
 */

const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    id: { type: String, default: 'settings_1', unique: true },
    name: { type: String, default: 'Choo Choo Tortas' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    taxRate: { type: Number, default: 8.25 },
    currency: { type: String, default: 'USD' },
    currencySymbol: { type: String, default: '$' },
  },
  {
    timestamps: true, // automatically adds createdAt & updatedAt
  }
);

const Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;