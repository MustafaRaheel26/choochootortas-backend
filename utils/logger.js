/**
 * Logger Utility for Backend
 * 
 * Provides consistent logging across the application
 * Uses Winston for structured logging
 */

const winston = require('winston');

// Define log format
const logFormat = winston.format.printf(({ timestamp, level, message, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  if (Object.keys(metadata).length > 0 && metadata.metadata) {
    msg += ` ${JSON.stringify(metadata.metadata)}`;
  }
  return msg;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    winston.format.colorize(),
    logFormat
  ),
  transports: [
    new winston.transports.Console()
  ]
});

module.exports = { logger };