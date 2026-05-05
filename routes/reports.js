/**
 * Reports Routes - MongoDB Version
 * Used by: ADMIN Dashboard
 */

const express = require('express');
const router = express.Router();
const { Order, MenuItem, Category, Settings } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// Helper to get date range
const getDateRange = (range, baseDate = new Date()) => {
  const endDate = new Date(baseDate);
  endDate.setHours(23, 59, 59, 999);
  
  let startDate = new Date(baseDate);
  startDate.setHours(0, 0, 0, 0);
  
  switch (range) {
    case 'today': break;
    case 'yesterday':
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
      break;
    case 'week': startDate.setDate(startDate.getDate() - 7); break;
    case 'month': startDate.setMonth(startDate.getMonth() - 1); break;
    case 'quarter': startDate.setMonth(startDate.getMonth() - 3); break;
    case 'year': startDate.setFullYear(startDate.getFullYear() - 1); break;
    default: startDate.setDate(startDate.getDate() - 7);
  }
  
  return { startDate, endDate };
};

// Debug: Check if models are loaded
console.log('🔍 routes/reports.js - Models loaded:', {
  Order: typeof Order === 'function',
  Category: typeof Category === 'function',
  Settings: typeof Settings === 'function'
});

/**
 * GET /api/reports/sales
 * Get comprehensive sales report for admin dashboard
 */
router.get('/sales', authenticateToken, async (req, res, next) => {
  try {
    const { range = 'week' } = req.query;
    console.log(`📊 Generating sales report for range: ${range}`);
    
    const { startDate, endDate } = getDateRange(range);
    
    const completedOrders = await Order.find({
      status: 'completed',
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    const allOrders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    console.log(`📊 Found ${completedOrders.length} completed orders, ${allOrders.length} total orders`);
    
    const totalSales = completedOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const taxCollected = completedOrders.reduce((sum, order) => sum + (order.tax || 0), 0);
    const totalOrders = completedOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    const settings = await Settings.findOne({ id: 'settings_1' });
    const currentTaxRate = settings?.taxRate || 8.25;
    
    const dineInOrders = allOrders.filter(o => o.orderType === 'eat-in');
    const takeOutOrders = allOrders.filter(o => o.orderType === 'take-out');
    const dineInTotal = dineInOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const takeOutTotal = takeOutOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const dineInCount = dineInOrders.length;
    const takeOutCount = takeOutOrders.length;
    
    const categories = await Category.find();
    
    const itemsSoldByCategory = await Promise.all(categories.map(async (cat) => {
      let count = 0;
      let revenue = 0;
      
      completedOrders.forEach(order => {
        order.items.forEach(orderItem => {
          count += orderItem.quantity;
          revenue += (orderItem.price || 0) * orderItem.quantity;
        });
      });
      
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        count: count,
        revenue: revenue,
      };
    }));
    
    const recentSales = [];
    const daysToShow = 7;
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      
      const dayOrders = completedOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= date && orderDate < nextDate;
      });
      
      const daySales = dayOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      
      recentSales.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: date.toISOString().split('T')[0],
        amount: daySales,
        orders: dayOrders.length,
      });
    }
    
    const responseData = {
      totalSales,
      taxCollected,
      totalOrders,
      avgOrderValue,
      currentTaxRate,
      dineInTotal,
      takeOutTotal,
      dineInCount,
      takeOutCount,
      itemsSoldByCategory: itemsSoldByCategory.filter(c => c.count > 0 || c.revenue > 0),
      recentSales,
    };
    
    console.log('✅ Sales report generated successfully');
    
    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('❌ Error in /reports/sales:', error);
    next(error);
  }
});

/**
 * GET /api/reports/sales/daily
 * Get daily sales data for chart
 */
router.get('/sales/daily', authenticateToken, async (req, res, next) => {
  try {
    const { range = 'week' } = req.query;
    const { startDate, endDate } = getDateRange(range);
    
    const completedOrders = await Order.find({
      status: 'completed',
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    const recentSales = [];
    const daysToShow = 7;
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      
      const dayOrders = completedOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= date && orderDate < nextDate;
      });
      
      const daySales = dayOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      
      recentSales.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: date.toISOString().split('T')[0],
        amount: daySales,
        orders: dayOrders.length,
      });
    }
    
    res.json({
      success: true,
      data: recentSales,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/categories
 * Get sales breakdown by category
 */
router.get('/categories', authenticateToken, async (req, res, next) => {
  try {
    const { range = 'week' } = req.query;
    const { startDate, endDate } = getDateRange(range);
    
    const completedOrders = await Order.find({
      status: 'completed',
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    const categories = await Category.find();
    
    const itemsSoldByCategory = await Promise.all(categories.map(async (cat) => {
      let count = 0;
      let revenue = 0;
      
      completedOrders.forEach(order => {
        order.items.forEach(orderItem => {
          count += orderItem.quantity;
          revenue += (orderItem.price || 0) * orderItem.quantity;
        });
      });
      
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        count: count,
        revenue: revenue,
      };
    }));
    
    res.json({
      success: true,
      data: itemsSoldByCategory.filter(c => c.count > 0 || c.revenue > 0),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;