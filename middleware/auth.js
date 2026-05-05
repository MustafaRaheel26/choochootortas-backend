/**
 * Authentication Middleware
 * 
 * Protects admin-only routes (menu management, settings, reports)
 * Uses JWT (JSON Web Tokens) for secure authentication.
 */

const jwt = require('jsonwebtoken');

// JWT secret key from .env file
const JWT_SECRET = process.env.JWT_SECRET || 'choochootortas_super_secret_key';

/**
 * Middleware to verify JWT token
 * Add this to routes that require admin access
 */
const authenticateToken = (req, res, next) => {
  // Get token from Authorization header
  // Format: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔐 Auth middleware - Request to:', req.method, req.url);
  console.log('🔐 Auth header present:', !!authHeader);
  console.log('🔐 Token present:', !!token);

  if (!token) {
    console.log('❌ Auth failed: No token provided');
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token verified successfully for user:', decoded.userId);
    
    // Attach user info to request for use in routes
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('❌ Auth failed: Token expired');
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
      });
    }
    
    console.log('❌ Auth failed:', error.message);
    return res.status(403).json({
      success: false,
      message: 'Invalid token.',
    });
  }
};

/**
 * Optional: Admin-only middleware (if you have different user roles)
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.',
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
};