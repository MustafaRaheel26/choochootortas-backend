/**
 * Order Model - MongoDB Schema
 * 
 * Matches the order structure from:
 * - KIOSK (when customer checks out)
 * - KITCHEN (for displaying orders)
 * - ADMIN (for order management)
 */

const mongoose = require('mongoose');

// Define the order item sub-schema
const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    removed: { type: [String], default: [] },
    extras: { type: [String], default: [] },
  },
  { _id: true }
);

// Define the main order schema
const orderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: ['new', 'preparing', 'ready', 'completed'],
      default: 'new',
      required: true,
    },
    orderType: {
      type: String,
      enum: ['eat-in', 'take-out'],
      required: true,
    },
    totalPrice: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
  },
  {
    timestamps: true, // automatically adds createdAt & updatedAt
  }
);

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;