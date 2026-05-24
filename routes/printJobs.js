/**
 * Print Jobs Routes - For polling architecture
 * 
 * Used by bridge service to:
 * - GET /api/print-jobs/pending - Poll for pending jobs
 * - POST /api/print-jobs/:jobId/complete - Mark job as completed
 * - POST /api/print-jobs/:jobId/failed - Mark job as failed
 * - POST /api/print-jobs/:jobId/status - Update job status with order linkage
 */

const express = require('express');
const router = express.Router();
const PrintJob = require('../models/PrintJob');
const Order = require('../models/Order');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

// Logger
let logger = null;
try {
  logger = require('../utils/logger').logger;
} catch (error) {
  logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args)
  };
}

// Simple API key auth for bridge (same as before)
const authenticateBridge = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.PRINTER_BRIDGE_API_KEY || 'dev-bridge-key-12345';
  
  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

/**
 * GET /api/print-jobs/pending
 * Bridge polls this endpoint every 1-2 seconds
 * Returns up to 10 pending jobs
 */
router.get('/pending', authenticateBridge, async (req, res, next) => {
  try {
    const pendingJobs = await PrintJob.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(10);
    
    res.json({
      success: true,
      jobs: pendingJobs,
      count: pendingJobs.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/print-jobs/:jobId/complete
 * Bridge calls this after successful printing
 */
router.post('/:jobId/complete', authenticateBridge, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    
    const job = await PrintJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();
    
    // Update order print status
    if (job.orderId) {
      const order = await Order.findOne({ id: job.orderId });
      if (order) {
        const printType = job.type;
        if (!order.printStatus) order.printStatus = {};
        
        order.printStatus[printType] = 'completed';
        
        // Check if all prints are completed
        const allCompleted = 
          order.printStatus.kitchen === 'completed' &&
          order.printStatus.bar === 'completed' &&
          order.printStatus.customer === 'completed';
        
        if (allCompleted) {
          order.printStatus.completedAt = new Date();
          logger.info(`All prints completed for order ${order.id}`);
        }
        
        await order.save();
        logger.info(`Print status updated for order ${order.id}: ${printType} = completed`);
      }
    }
    
    res.json({ success: true, message: 'Job marked as completed' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/print-jobs/:jobId/failed
 * Bridge calls this after failed printing (optional, for tracking)
 */
router.post('/:jobId/failed', authenticateBridge, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { error } = req.body;
    
    const job = await PrintJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    job.status = 'failed';
    job.error = error || 'Unknown error';
    await job.save();
    
    // Update order print status
    if (job.orderId) {
      const order = await Order.findOne({ id: job.orderId });
      if (order) {
        const printType = job.type;
        if (!order.printStatus) order.printStatus = {};
        
        order.printStatus[printType] = 'failed';
        order.printStatus.lastError = error || 'Unknown error';
        order.printStatus.retryCount = (order.printStatus.retryCount || 0) + 1;
        
        await order.save();
        logger.warn(`Print failed for order ${order.id}: ${printType} - ${error || 'Unknown error'}`);
      }
    }
    
    res.json({ success: true, message: 'Job marked as failed' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/print-jobs/:jobId/status
 * Update print job status with detailed info
 */
router.post('/:jobId/status', authenticateBridge, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { status, error, printerType } = req.body;
    
    const job = await PrintJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    // Update job status
    job.status = status === 'completed' ? 'completed' : 'failed';
    if (error) job.error = error;
    if (printerType) job.printerType = printerType;
    if (status === 'completed') job.completedAt = new Date();
    await job.save();
    
    // Update order print status
    if (job.orderId) {
      const order = await Order.findOne({ id: job.orderId });
      if (order) {
        const printType = job.type;
        if (!order.printStatus) order.printStatus = {};
        
        if (status === 'completed') {
          order.printStatus[printType] = 'completed';
        } else {
          order.printStatus[printType] = 'failed';
          order.printStatus.lastError = error;
          order.printStatus.retryCount = (order.printStatus.retryCount || 0) + 1;
        }
        
        // Check if all prints are completed
        const allCompleted = 
          order.printStatus.kitchen === 'completed' &&
          order.printStatus.bar === 'completed' &&
          order.printStatus.customer === 'completed';
        
        if (allCompleted && status === 'completed') {
          order.printStatus.completedAt = new Date();
          logger.info(`All prints completed for order ${order.id}`);
        }
        
        await order.save();
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/print-jobs/order/:orderId
 * Get all print jobs for a specific order (Admin)
 */
router.get('/order/:orderId', authenticateToken, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    
    const jobs = await PrintJob.find({ orderId }).sort({ createdAt: 1 });
    
    res.json({
      success: true,
      jobs,
      count: jobs.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/print-jobs/:jobId/retry
 * Retry a failed print job (Admin)
 */
router.post('/:jobId/retry', authenticateToken, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    
    const job = await PrintJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    if (job.status !== 'failed') {
      return res.status(400).json({ success: false, error: 'Only failed jobs can be retried' });
    }
    
    job.status = 'pending';
    job.error = null;
    job.attempts = 0;
    await job.save();
    
    // Update order print status
    if (job.orderId) {
      const order = await Order.findOne({ id: job.orderId });
      if (order && order.printStatus) {
        order.printStatus[job.type] = 'pending';
        await order.save();
      }
    }
    
    logger.info(`Print job ${jobId} marked for retry`);
    
    res.json({
      success: true,
      message: 'Print job marked for retry',
      job
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/print-jobs (Admin only) - Manually create test job
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { type, orderId, orderNumber, orderData } = req.body;
    
    if (!type || !orderId || !orderNumber || !orderData) {
      throw new ValidationError('Missing required fields');
    }
    
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const newJob = new PrintJob({
      jobId,
      type,
      orderId,
      orderNumber,
      orderData,
      status: 'pending'
    });
    
    await newJob.save();
    
    res.status(201).json({
      success: true,
      message: 'Print job created',
      job: newJob
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;