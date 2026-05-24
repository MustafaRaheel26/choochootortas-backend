/**
 * Order Model - MongoDB Schema
 * 
 * Matches the order structure from:
 * - KIOSK (when customer checks out)
 * - KITCHEN (for displaying orders)
 * - ADMIN (for order management)
 * 
 * Enhanced with payment tracking and print status fields
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

// Define print status sub-schema
const printStatusSchema = new mongoose.Schema(
  {
    kitchen: { type: String, enum: ['pending', 'printing', 'completed', 'failed'], default: 'pending' },
    bar: { type: String, enum: ['pending', 'printing', 'completed', 'failed'], default: 'pending' },
    customer: { type: String, enum: ['pending', 'printing', 'completed', 'failed'], default: 'pending' },
    lastError: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
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
    // Payment tracking fields
    paymentSessionId: { type: String, default: null },
    paymentTransactionId: { type: String, default: null },
    // Print status tracking
    printStatus: { type: printStatusSchema, default: () => ({}) },
  },
  {
    timestamps: true, // automatically adds createdAt & updatedAt
  }
);

// Index for payment lookup
orderSchema.index({ paymentSessionId: 1 });
// Index for print status queries
orderSchema.index({ 'printStatus.kitchen': 1 });
orderSchema.index({ 'printStatus.bar': 1 });
orderSchema.index({ 'printStatus.customer': 1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;