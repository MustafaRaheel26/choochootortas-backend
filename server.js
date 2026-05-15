/**
 * Restaurant Backend Server - With MongoDB
 * 
 * Main entry point for the entire backend system.
 * Handles:
 * - API routing for all three apps (Kiosk, Kitchen, Admin)
 * - CORS for cross-origin requests
 * - Authentication for admin routes
 * - Error handling
 * - MongoDB Database connection
 * 
 * Start with: npm start or npm run dev
 */
require('dotenv').config();

const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const {
  corsMiddleware,
  loggerMiddleware,
  errorHandler,
  notFoundHandler,
} = require('./middleware');
const {
  ordersRoutes,
  menuRoutes,
  categoriesRoutes,
  settingsRoutes,
  reportsRoutes,
  authRoutes,
} = require('./routes');
const printJobsRoutes = require('./routes/printJobs');

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB
connectDB();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// ==================== CRITICAL: JSON PARSER MUST BE FIRST ====================

// IMPORTANT: These middleware MUST be in this exact order!

// 1. JSON Parser - Parse JSON request bodies (CRITICAL for POST requests)
app.use(express.json({ limit: '10mb' }));

// 2. URL Encoded Parser - Parse form data
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Logger - Log all incoming requests
app.use(loggerMiddleware);

// 4. CORS - Allow frontend apps to connect (after JSON parser)
app.use(corsMiddleware);

// ==================== VERIFY MODELS ARE LOADED ====================
const { Order, MenuItem, Category, Settings } = require('./models');
console.log('\n🔍 Model Verification:');
console.log('   Order:', typeof Order === 'function' ? '✅ Loaded' : '❌ Failed');
console.log('   MenuItem:', typeof MenuItem === 'function' ? '✅ Loaded' : '❌ Failed');
console.log('   Category:', typeof Category === 'function' ? '✅ Loaded' : '❌ Failed');
console.log('   Settings:', typeof Settings === 'function' ? '✅ Loaded' : '❌ Failed');
console.log('');

// ==================== API ROUTES ====================

// Base API route (health check)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '🍽️ Choo Choo Tortas API is running with MongoDB!',
    timestamp: new Date().toISOString(),
    database: process.env.MONGODB_URI ? 'MongoDB Connected' : 'Memory Store',
    models: {
      Order: typeof Order === 'function',
      MenuItem: typeof MenuItem === 'function',
      Category: typeof Category === 'function',
      Settings: typeof Settings === 'function',
    },
    endpoints: {
      orders: '/api/orders',
      menu: '/api/menu',
      categories: '/api/categories',
      settings: '/api/settings',
      reports: '/api/reports',
      auth: '/api/auth',
      printJobs: '/api/print-jobs',
    },
  });
});

// Register all route modules
app.use('/api/orders', ordersRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/print-jobs', printJobsRoutes);

// ==================== ERROR HANDLING (Must be last) ====================

// 404 handler for routes that don't exist
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🍽️  CHOO CHOO TORTAS BACKEND');
  console.log('=================================');
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📋 API base URL: http://localhost:${PORT}/api`);
  console.log('📡 Database: MongoDB Atlas');
  console.log('\n📡 Available Endpoints:');
  console.log('   POST   /api/orders              - Create order (Kiosk)');
  console.log('   GET    /api/orders              - Get all orders');
  console.log('   GET    /api/orders/kitchen/live - Get active orders (Kitchen)');
  console.log('   PUT    /api/orders/:id/status   - Update order status');
  console.log('   GET    /api/menu                - Get menu (Kiosk)');
  console.log('   GET    /api/categories          - Get categories (Kiosk)');
  console.log('   GET    /api/settings/tax        - Get tax rate (Kiosk cart)');
  console.log('   POST   /api/auth/login          - Admin login (Admin)');
  console.log('   GET    /api/print-jobs/pending  - Bridge polls for print jobs');
  console.log('   POST   /api/print-jobs/:id/complete - Mark job completed');
  console.log('\n🔒 Protected Routes (require auth token):');
  console.log('   POST   /api/menu                - Add menu item');
  console.log('   PUT    /api/menu/:id            - Update menu item');
  console.log('   DELETE /api/menu/:id            - Delete menu item');
  console.log('   POST   /api/categories          - Add category');
  console.log('   PUT    /api/categories/:id      - Update category');
  console.log('   DELETE /api/categories/:id      - Delete category');
  console.log('   PUT    /api/settings            - Update settings');
  console.log('   GET    /api/reports/sales       - Get sales report');
  console.log('\n🌐 CORS Enabled for all localhost ports');
  console.log('=================================\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});