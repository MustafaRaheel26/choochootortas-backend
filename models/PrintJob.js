/**
 * PrintJob Model - Stores pending print jobs for bridge polling
 * 
 * Used by polling architecture:
 * - Backend creates jobs when order is placed
 * - Bridge polls for pending jobs every 1-2 seconds
 * - Bridge marks jobs as completed after successful printing
 */

const mongoose = require('mongoose');

const printJobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true },
    type: { 
      type: String, 
      enum: ['kitchen', 'bar', 'customer'], 
      required: true 
    },
    orderId: { type: String, required: true }, // e.g., "order_001"
    orderNumber: { type: String, required: true },
    orderData: { type: mongoose.Schema.Types.Mixed, required: true }, // Full data needed for printing
    status: { 
      type: String, 
      enum: ['pending', 'completed', 'failed'], 
      default: 'pending' 
    },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Index for efficient polling
printJobSchema.index({ status: 1, createdAt: 1 });

const PrintJob = mongoose.model('PrintJob', printJobSchema);
module.exports = PrintJob;