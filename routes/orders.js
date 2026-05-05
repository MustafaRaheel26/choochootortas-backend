/**
 * Orders Routes - MongoDB Version
 * 
 * Used by:
 * - KIOSK: POST /api/orders (create order)
 * - KITCHEN: GET /api/orders (fetch all), GET /api/orders/kitchen/live (active orders)
 * - KITCHEN + ADMIN: PUT /api/orders/:id/status (update status)
 * - ADMIN: GET /api/orders (view all orders)
 * - KIOSK: GET /api/orders/next-number (reserve order number for slip)
 */

const express = require('express');
const router = express.Router();
const { Order } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

// Debug: Check if Order is loaded
console.log('🔍 routes/orders.js - Order model loaded:', typeof Order === 'function' ? '✅' : '❌');

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

// ==================== GET ROUTES ====================

/**
 * GET /api/orders/next-number
 * Get the next order number WITHOUT creating an order
 * Used by: KIOSK (to show order number on slip before payment)
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
 * Used by: KITCHEN, ADMIN
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
 * Used by: KITCHEN DASHBOARD
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
 * Used by: KITCHEN, ADMIN
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
 * Create a new order
 * Used by: KIOSK (when customer checks out)
 */
router.post('/', async (req, res, next) => {
  try {
    const { items, orderType } = req.body;
    
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
    
    const newOrder = new Order({
      id: `order_${orderNumber}`,
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
 * Used by: KITCHEN, ADMIN
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

module.exports = router;