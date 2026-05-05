/**
 * Menu Routes - MongoDB Version
 * 
 * Used by:
 * - KIOSK: GET /api/menu (read menu)
 * - ADMIN: GET, POST, PUT, DELETE (full CRUD)
 * 
 * Note: POST, PUT, DELETE require authentication (admin only)
 */

const express = require('express');
const router = express.Router();
const { MenuItem, Category } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

// Helper: Generate unique ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// Debug: Check if models are loaded
console.log('🔍 routes/menu.js - MenuItem model loaded:', typeof MenuItem === 'function' ? '✅' : '❌');
console.log('🔍 routes/menu.js - Category model loaded:', typeof Category === 'function' ? '✅' : '❌');

// ==================== PUBLIC GET ROUTES ====================

/**
 * GET /api/menu
 * Get all menu items (with full details)
 * Used by: KIOSK, ADMIN
 */
router.get('/', async (req, res, next) => {
  try {
    console.log('📝 GET /api/menu - Fetching all menu items');
    const { categoryId } = req.query;
    let query = {};
    if (categoryId) {
      query.categoryId = categoryId;
    }
    const menuItems = await MenuItem.find(query).sort({ createdAt: -1 });
    console.log(`✅ Found ${menuItems.length} menu items`);
    res.json({
      success: true,
      data: menuItems,
      count: menuItems.length,
    });
  } catch (error) {
    console.log('❌ Error in GET /menu:', error.message);
    next(error);
  }
});

/**
 * GET /api/menu/:id
 * Get single menu item by ID
 * Used by: ADMIN
 */
router.get('/:id', async (req, res, next) => {
  try {
    console.log(`📝 GET /api/menu/:id - Fetching item: ${req.params.id}`);
    const menuItem = await MenuItem.findOne({ id: req.params.id });
    if (!menuItem) {
      throw new NotFoundError('Menu item');
    }
    res.json({
      success: true,
      data: menuItem,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PROTECTED ROUTES ====================

/**
 * POST /api/menu
 * Create new menu item
 * Used by: ADMIN
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    console.log('='.repeat(50));
    console.log('📝 POST /api/menu - RAW Request');
    console.log('📝 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('📝 Body:', JSON.stringify(req.body, null, 2));
    console.log('='.repeat(50));
    
    const body = req.body;
    
    let itemName = body.itemName || body.name;
    let price = body.price;
    let description = body.description || '';
    let ingredients = body.ingredients || [];
    let removeOptions = body.removeOptions || [];
    let extras = body.extras || [];
    let categoryId = body.categoryId;
    let available = body.available !== undefined ? body.available : true;
    let isBestseller = body.isBestseller || false;
    let image = body.image || '';
    
    console.log('📝 Extracted values:');
    console.log('   itemName:', itemName);
    console.log('   price:', price);
    console.log('   categoryId:', categoryId);
    
    if (!itemName || itemName.trim() === '') {
      throw new ValidationError('Item name is required');
    }
    if (!price || price <= 0) {
      throw new ValidationError('Valid price is required');
    }
    if (!categoryId) {
      throw new ValidationError('Category ID is required');
    }
    
    const category = await Category.findOne({ id: categoryId });
    if (!category) {
      throw new ValidationError('Category does not exist');
    }
    
    const newItem = new MenuItem({
      id: generateId(),
      itemName: itemName.trim(),
      price: parseFloat(price),
      description: description,
      image: image,
      ingredients: Array.isArray(ingredients) ? ingredients.filter(i => i && i.trim()) : [],
      removeOptions: Array.isArray(removeOptions) ? removeOptions : [],
      extras: Array.isArray(extras) ? extras : [],
      categoryId: categoryId,
      available: available,
      isBestseller: isBestseller,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    await newItem.save();
    
    console.log('✅ Menu item created successfully:', newItem.id);
    
    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: newItem,
    });
  } catch (error) {
    console.log('❌ Error in POST /menu:', error.message);
    next(error);
  }
});

/**
 * PUT /api/menu/:id
 * Update menu item
 * Used by: ADMIN
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const itemId = req.params.id;
    const updates = req.body;
    
    console.log('📝 PUT /api/menu/:id - Updating:', itemId);
    
    const existingItem = await MenuItem.findOne({ id: itemId });
    if (!existingItem) {
      throw new NotFoundError('Menu item');
    }
    
    if (updates.itemName !== undefined) existingItem.itemName = updates.itemName;
    if (updates.price !== undefined) existingItem.price = updates.price;
    if (updates.description !== undefined) existingItem.description = updates.description;
    if (updates.image !== undefined) existingItem.image = updates.image;
    if (updates.ingredients !== undefined) existingItem.ingredients = updates.ingredients;
    if (updates.removeOptions !== undefined) existingItem.removeOptions = updates.removeOptions;
    if (updates.extras !== undefined) existingItem.extras = updates.extras;
    
    if (updates.categoryId !== undefined) {
      const category = await Category.findOne({ id: updates.categoryId });
      if (!category) {
        throw new ValidationError('New category does not exist');
      }
      existingItem.categoryId = updates.categoryId;
    }
    
    if (updates.available !== undefined) existingItem.available = updates.available;
    if (updates.isBestseller !== undefined) existingItem.isBestseller = updates.isBestseller;
    
    existingItem.updatedAt = new Date();
    await existingItem.save();
    
    console.log('✅ Menu item updated successfully:', itemId);
    
    res.json({
      success: true,
      message: 'Menu item updated successfully',
      data: existingItem,
    });
  } catch (error) {
    console.log('❌ Error in PUT /menu:', error.message);
    next(error);
  }
});

/**
 * DELETE /api/menu/:id
 * Delete menu item
 * Used by: ADMIN
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const itemId = req.params.id;
    
    const existingItem = await MenuItem.findOne({ id: itemId });
    if (!existingItem) {
      throw new NotFoundError('Menu item');
    }
    
    await MenuItem.deleteOne({ id: itemId });
    
    res.json({
      success: true,
      message: 'Menu item deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/menu/:id/availability
 * Toggle menu item availability
 * Used by: ADMIN
 */
router.patch('/:id/availability', authenticateToken, async (req, res, next) => {
  try {
    const itemId = req.params.id;
    const { available } = req.body;
    
    if (available === undefined) {
      throw new ValidationError('Available status is required');
    }
    
    const existingItem = await MenuItem.findOne({ id: itemId });
    if (!existingItem) {
      throw new NotFoundError('Menu item');
    }
    
    existingItem.available = available;
    existingItem.updatedAt = new Date();
    await existingItem.save();
    
    res.json({
      success: true,
      message: `Menu item ${available ? 'available' : 'unavailable'} successfully`,
      data: existingItem,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;