/**
 * PaymentSession Model - Temporary payment record before order confirmation
 * 
 * Used for Datacap/NETePay integration
 * - Created when customer initiates payment
 * - Deleted/archived after payment completion
 * - Prevents duplicate orders
 */

const mongoose = require('mongoose');

const paymentSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    orderData: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'approved', 'declined', 'failed', 'timeout', 'cancelled'],
      default: 'pending'
    },
    paymentMethod: { type: String, default: 'card' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    datacapTransactionId: { type: String, default: null },
    datacapResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    errorMessage: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    // New fields for payment locking
    orderCreated: { type: Boolean, default: false },
    orderId: { type: String, default: null },
  },
  { timestamps: true }
);

// Indexes for cleanup and lookups
// Note: sessionId index is automatically created by 'unique: true' - no need to duplicate
paymentSessionSchema.index({ status: 1, expiresAt: 1 });
paymentSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
paymentSessionSchema.index({ orderCreated: 1 }); // For finding unused sessions

const PaymentSession = mongoose.model('PaymentSession', paymentSessionSchema);
module.exports = PaymentSession;