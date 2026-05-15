/**
 * Print Jobs Routes - For polling architecture
 * 
 * Used by bridge service to:
 * - GET /api/print-jobs/pending - Poll for pending jobs
 * - POST /api/print-jobs/:jobId/complete - Mark job as completed
 * - POST /api/print-jobs/:jobId/failed - Mark job as failed
 */

const express = require('express');
const router = express.Router();
const PrintJob = require('../models/PrintJob');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

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
    
    res.json({ success: true, message: 'Job marked as failed' });
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