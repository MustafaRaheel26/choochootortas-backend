/**
 * Logger Utility for Backend
 * 
 * Provides consistent logging across the application
 * Uses Winston for structured logging
 * 
 * Enhanced with payment-specific logging and file output
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define custom log levels
const customLevels = {
  error: 0,
  warn: 1,
  info: 2,
  payment: 3,  // Payment-specific logs
  debug: 4
};

// Define colors for custom levels
const customColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  payment: 'magenta',
  debug: 'blue'
};

winston.addColors(customColors);

// Define log format
const logFormat = winston.format.printf(({ timestamp, level, message, ...metadata }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  if (Object.keys(metadata).length > 0 && metadata.metadata) {
    msg += ` ${JSON.stringify(metadata.metadata)}`;
  }
  return msg;
});

// JSON format for file logging (easier parsing)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  levels: customLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
  ),
  transports: [
    // Console transport (colored)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        logFormat
      ),
      level: 'debug'
    }),
    
    // Combined log file (all logs)
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: jsonFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      level: 'info'
    }),
    
    // Error log file (errors only)
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      format: jsonFormat,
      maxsize: 10485760,
      maxFiles: 5,
      level: 'error'
    }),
    
    // Payment log file (payment-related only)
    new winston.transports.File({
      filename: path.join(logDir, 'payment.log'),
      format: jsonFormat,
      maxsize: 10485760,
      maxFiles: 5,
      level: 'payment'
    })
  ]
});

// Helper function for payment logging
const logPayment = (action, sessionId, details = {}) => {
  logger.log({
    level: 'payment',
    message: `[PAYMENT] ${action}`,
    metadata: {
      sessionId,
      ...details,
      timestamp: new Date().toISOString()
    }
  });
};

// Helper function for payment session lifecycle
const logPaymentSession = {
  created: (sessionId, amount, orderData) => {
    logPayment('SESSION_CREATED', sessionId, {
      amount,
      orderType: orderData?.orderType,
      itemCount: orderData?.items?.length,
      orderNumber: orderData?.orderNumber
    });
  },
  
  initiated: (sessionId, amount) => {
    logPayment('PAYMENT_INITIATED', sessionId, { amount });
  },
  
  approved: (sessionId, transactionId, processingTimeMs) => {
    logPayment('PAYMENT_APPROVED', sessionId, {
      transactionId,
      processingTimeMs
    });
  },
  
  declined: (sessionId, reason, responseCode) => {
    logPayment('PAYMENT_DECLINED', sessionId, {
      reason,
      responseCode
    });
  },
  
  failed: (sessionId, error, errorDetails) => {
    logPayment('PAYMENT_FAILED', sessionId, {
      error,
      errorDetails
    });
  },
  
  timeout: (sessionId, timeoutMs) => {
    logPayment('PAYMENT_TIMEOUT', sessionId, { timeoutMs });
  },
  
  cancelled: (sessionId, reason) => {
    logPayment('PAYMENT_CANCELLED', sessionId, { reason });
  },
  
  orderCreated: (sessionId, orderId, orderNumber) => {
    logPayment('ORDER_CREATED', sessionId, {
      orderId,
      orderNumber
    });
  },
  
  retry: (sessionId, attemptNumber, previousError) => {
    logPayment('PAYMENT_RETRY', sessionId, {
      attemptNumber,
      previousError
    });
  }
};

module.exports = { 
  logger,
  logPayment,
  logPaymentSession
};