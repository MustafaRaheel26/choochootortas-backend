/**
 * Category Model - MongoDB Schema
 * 
 * Matches the category structure from:
 * - KIOSK (for menu navigation)
 * - ADMIN (for category management)
 */

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true, // automatically adds createdAt & updatedAt
  }
);

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;