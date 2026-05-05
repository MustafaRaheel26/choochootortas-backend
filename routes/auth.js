/**
 * Authentication Routes
 * 
 * Used by:
 * - ADMIN: POST /api/auth/login (login page)
 * - ADMIN: GET /api/auth/verify (check if token is valid)
 * - ADMIN: POST /api/auth/logout (logout)
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'choochootortas_super_secret_key';

// Debug
console.log('🔍 routes/auth.js - Auth routes loaded');

/**
 * POST /api/auth/login
 * Admin login
 * Used by: ADMIN Dashboard (Login.tsx)
 * 
 * Expected request body:
 * {
 *   "password": "tortas2026"
 * }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      throw new ValidationError('Password is required');
    }
    
    // Simple password check (in production, use bcrypt)
    const validPassword = password === 'tortas2026';
    
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
      });
    }
    
    const token = jwt.sign(
      { 
        userId: 'admin_001',
        role: 'admin',
        name: 'Admin User',
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: 'admin_001',
          name: 'Admin User',
          role: 'admin',
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/verify
 * Verify JWT token (check if still valid)
 * Used by: ADMIN Dashboard (to check login status)
 */
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user,
    },
  });
});

/**
 * POST /api/auth/logout
 * Admin logout (client-side token removal)
 * Used by: ADMIN Dashboard
 */
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

module.exports = router;