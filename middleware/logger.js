/**
 * Request Logger Middleware
 * 
 * Logs all incoming requests to the console.
 * Helpful for debugging and monitoring.
 */

const loggerMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Log when request starts
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m'; // Red for errors, green for success
    console.log(`  → ${statusColor}${res.statusCode}\x1b[0m - ${duration}ms`);
  });
  
  next();
};

module.exports = loggerMiddleware;