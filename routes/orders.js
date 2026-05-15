/**
 * Orders Routes - MongoDB Version with Print Job Creation (Polling Architecture)
 * 
 * Used by:
 * - KIOSK: POST /api/orders (create order)
 * - KITCHEN: GET /api/orders (fetch all), GET /api/orders/kitchen/live (active orders)
 * - KITCHEN + ADMIN: PUT /api/orders/:id/status (update status)
 * - ADMIN: GET /api/orders (view all orders)
 * - KIOSK: GET /api/orders/next-number (reserve order number for slip)
 * 
 * Printer integration: Creates print jobs in MongoDB for bridge to poll.
 */

const express = require('express');
const router = express.Router();
const { Order } = require('../models');
const PrintJob = require('../models/PrintJob');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

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

// Debug: Check if Order is loaded
console.log('🔍 routes/orders.js - Order model loaded:', typeof Order === 'function' ? '✅' : '❌');
console.log('🔍 routes/orders.js - PrintJob model loaded:', typeof PrintJob === 'function' ? '✅' : '❌');

// Helper: Get next sequential order number
const getNextOrderNumber = async () => {
  try {
    const lastOrder = await Order.findOne().sort({ createdAt: -1 });
    if (!lastOrder) return 1;
    const lastNumber = parseInt(lastOrder.id.split('_')[1], 10);
    return isNaN(lastNumber) ? 1 : lastNumber + 1;
  } catch (error) {
    console.error('Error getting next order number:', error);
    return 1;
  }
};

// Helper: Create print jobs for kitchen, bar, and customer receipt
const createPrintJobs = async (orderId, orderNumber, orderType, items, notes, subtotal, tax, totalPrice) => {
  const jobs = [];
  
  // Prepare order data for kitchen/bar (no prices)
  const productionOrderData = {
    orderNumber,
    orderType,
    items: items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      removed: item.removed || [],
      extras: item.extras || []
    })),
    notes: notes || ''
  };
  
  // Kitchen job
  const kitchenJob = new PrintJob({
    jobId: `${Date.now()}_kitchen_${orderNumber}`,
    type: 'kitchen',
    orderId,
    orderNumber,
    orderData: productionOrderData,
    status: 'pending'
  });
  jobs.push(kitchenJob.save());
  
  // Bar job
  const barJob = new PrintJob({
    jobId: `${Date.now()}_bar_${orderNumber}`,
    type: 'bar',
    orderId,
    orderNumber,
    orderData: productionOrderData,
    status: 'pending'
  });
  jobs.push(barJob.save());
  
  // Customer receipt job (with prices)
  const receiptOrderData = {
    orderNumber,
    orderType,
    items: items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      removed: item.removed || [],
      extras: item.extras || []
    })),
    subtotal,
    tax,
    totalPrice,
    notes: notes || '',
    timestamp: new Date().toISOString()
  };
  
  const receiptJob = new PrintJob({
    jobId: `${Date.now()}_receipt_${orderNumber}`,
    type: 'customer',
    orderId,
    orderNumber,
    orderData: receiptOrderData,
    status: 'pending'
  });
  jobs.push(receiptJob.save());
  
  await Promise.all(jobs);
  logger.info(`Created print jobs for order #${orderNumber}: kitchen, bar, customer`);
};

// ==================== GET ROUTES ====================

/**
 * GET /api/orders/next-number
 * Get the next order number WITHOUT creating an order
 */
router.get('/next-number', async (req, res, next) => {
  try {
    const nextNumber = await getNextOrderNumber();
    const orderNumber = nextNumber.toString().padStart(3, '0');
    res.json({
      success: true,
      data: {
        orderNumber: orderNumber,
        orderId: `order_${orderNumber}`
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders
 * Get all orders (sorted newest first)
 */
router.get('/', async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/kitchen/live
 * Get active orders for kitchen (new, preparing, ready - excludes completed)
 */
router.get('/kitchen/live', async (req, res, next) => {
  try {
    const activeOrders = await Order.find({ 
      status: { $in: ['new', 'preparing', 'ready'] } 
    }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: activeOrders,
      count: activeOrders.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/:id
 * Get single order by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) {
      throw new NotFoundError('Order');
    }
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== POST ROUTES ====================

/**
 * POST /api/orders
 * Create a new order and create print jobs for polling
 */
router.post('/', async (req, res, next) => {
  try {
    const { items, orderType, notes } = req.body;
    
    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Order must contain at least one item');
    }
    
    if (!orderType) {
      throw new ValidationError('Order type is required (eat-in or take-out)');
    }
    
    // Validate each item
    for (const item of items) {
      if (!item.name) {
        throw new ValidationError('Each order item must have a name');
      }
      if (!item.price || item.price <= 0) {
        throw new ValidationError(`Invalid price for item: ${item.name}`);
      }
      if (!item.quantity || item.quantity < 1) {
        throw new ValidationError(`Invalid quantity for item: ${item.name}`);
      }
    }
    
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = 8.25;
    const tax = subtotal * (taxRate / 100);
    const totalPrice = subtotal + tax;
    
    // Get next order number
    const nextNumber = await getNextOrderNumber();
    const orderNumber = nextNumber.toString().padStart(3, '0');
    const orderId = `order_${orderNumber}`;
    
    // Create order
    const newOrder = new Order({
      id: orderId,
      items: items,
      status: 'new',
      orderType: orderType,
      createdAt: new Date(),
      updatedAt: new Date(),
      totalPrice: totalPrice,
      tax: tax,
      subtotal: subtotal,
    });
    
    await newOrder.save();
    
    // Create print jobs (kitchen, bar, customer) - fire and forget
    createPrintJobs(orderId, orderNumber, orderType, items, notes || '', subtotal, tax, totalPrice)
      .catch(err => logger.error(`Failed to create print jobs for order #${orderNumber}:`, err));
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: newOrder,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PUT ROUTES ====================

/**
 * PUT /api/orders/:id/status
 * Update order status
 */
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;
    
    const validStatuses = ['new', 'preparing', 'ready', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      throw new ValidationError(`Status must be one of: ${validStatuses.join(', ')}`);
    }
    
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      throw new NotFoundError('Order');
    }
    
    order.status = status;
    order.updatedAt = new Date();
    await order.save();
    
    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== TEST ROUTES (Admin only) ====================

/**
 * GET /api/orders/test/create-print-jobs
 * Manually create test print jobs (for debugging)
 */
router.get('/test/create-print-jobs', authenticateToken, async (req, res, next) => {
  try {
    const testOrderId = `order_999`;
    const testOrderNumber = '999';
    const testItems = [
      { name: 'Test Item 1', quantity: 1, price: 10.99, removed: [], extras: [] },
      { name: 'Test Item 2', quantity: 2, price: 5.50, removed: ['onions'], extras: ['cheese'] }
    ];
    
    await createPrintJobs(testOrderId, testOrderNumber, 'eat-in', testItems, 'Test notes', 21.99, 1.81, 23.80);
    
    res.json({ success: true, message: 'Test print jobs created' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;