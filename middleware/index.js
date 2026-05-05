/**
 * Middleware Index
 * 
 * Exports all middleware for easy importing elsewhere
 */

const corsMiddleware = require('./cors');
const { authenticateToken, requireAdmin } = require('./auth');
const { errorHandler, notFoundHandler, APIError, ValidationError, NotFoundError } = require('./errorHandler');
const loggerMiddleware = require('./logger');

module.exports = {
  corsMiddleware,
  authenticateToken,
  requireAdmin,
  errorHandler,
  notFoundHandler,
  loggerMiddleware,
  APIError,
  ValidationError,
  NotFoundError,
};