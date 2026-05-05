/**
 * Menu Item Model - MongoDB Schema
 * 
 * Matches the menu item structure from:
 * - KIOSK (for displaying menu)
 * - ADMIN (for menu management)
 */

const mongoose = require('mongoose');

// Define the extra sub-schema
const extraSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

// Define the main menu item schema
const menuItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    itemName: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    ingredients: { type: [String], default: [] },
    removeOptions: { type: [String], default: [] },
    extras: [extraSchema],
    categoryId: { type: String, required: true },
    available: { type: Boolean, default: true },
    isBestseller: { type: Boolean, default: false },
  },
  {
    timestamps: true, // automatically adds createdAt & updatedAt
  }
);

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
module.exports = MenuItem;