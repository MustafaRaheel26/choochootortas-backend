/**
 * Routes Index
 * 
 * Exports all route modules for easy importing in server.js
 */

const ordersRoutes = require('./orders');
const menuRoutes = require('./menu');
const categoriesRoutes = require('./categories');
const settingsRoutes = require('./settings');
const reportsRoutes = require('./reports');
const authRoutes = require('./auth');

module.exports = {
  ordersRoutes,
  menuRoutes,
  categoriesRoutes,
  settingsRoutes,
  reportsRoutes,
  authRoutes,
};