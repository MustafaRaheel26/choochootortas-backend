/**
 * Categories Routes - MongoDB Version
 * 
 * Used by:
 * - KIOSK: GET /api/categories (read categories for navigation)
 * - ADMIN: GET, POST, PUT, DELETE (full CRUD)
 * 
 * Note: POST, PUT, DELETE require authentication (admin only)
 */

const express = require('express');
const router = express.Router();
const { Category, MenuItem } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

// Helper: Generate unique ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// Default placeholder image (same as fallback in kiosk)
const DEFAULT_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=600&h=400&fit=crop';

// Debug: Check if Category is loaded
console.log('🔍 routes/categories.js - Category model loaded:', typeof Category === 'function' ? '✅' : '❌');
console.log('🔍 routes/categories.js - MenuItem model loaded:', typeof MenuItem === 'function' ? '✅' : '❌');

// ==================== PUBLIC GET ROUTES (No Auth Required) ====================

/**
 * GET /api/categories
 * Get all categories (sorted by sortOrder) with computed image field.
 * Image logic:
 * - If category has at least one menu item, use the first item's image (by createdAt).
 * - Otherwise use a default placeholder.
 * Used by: KIOSK, ADMIN
 */
router.get('/', async (req, res, next) => {
  try {
    // Fetch all categories
    const categories = await Category.find().sort({ sortOrder: 1 });
    
    // Fetch all menu items (only needed fields: categoryId, image, createdAt)
    const allMenuItems = await MenuItem.find({}, { categoryId: 1, image: 1, createdAt: 1 }).lean();
    
    // Build a map: categoryId -> first menu item image (by createdAt asc)
    const categoryImageMap = new Map();
    for (const item of allMenuItems) {
      const catId = item.categoryId;
      if (!categoryImageMap.has(catId)) {
        // Store the image of the first item encountered (oldest by createdAt)
        categoryImageMap.set(catId, item.image && item.image.trim() !== '' ? item.image : DEFAULT_CATEGORY_IMAGE);
      }
    }
    
    // Attach computed image to each category
    const enrichedCategories = categories.map(cat => {
      const catObj = cat.toObject();
      const itemImage = categoryImageMap.get(cat.id);
      catObj.image = itemImage || DEFAULT_CATEGORY_IMAGE;
      return catObj;
    });
    
    console.log(`📤 GET /categories - Returning ${enrichedCategories.length} categories with computed images`);
    res.json({
      success: true,
      data: enrichedCategories,
      count: enrichedCategories.length,
    });
  } catch (error) {
    console.error('❌ Error in GET /categories:', error);
    next(error);
  }
});

/**
 * GET /api/categories/:id
 * Get single category by ID (with its menu items)
 * Used by: ADMIN
 */
router.get('/:id', async (req, res, next) => {
  try {
    const category = await Category.findOne({ id: req.params.id });
    if (!category) {
      throw new NotFoundError('Category');
    }
    
    const menuItems = await MenuItem.find({ categoryId: category.id });
    
    res.json({
      success: true,
      data: {
        ...category.toObject(),
        items: menuItems,
        itemCount: menuItems.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PROTECTED ROUTES (Admin Only) ====================

/**
 * POST /api/categories
 * Create new category
 * Used by: ADMIN
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { name } = req.body;
    
    console.log('📝 POST /categories - Creating category:', name);
    
    if (!name || name.trim() === '') {
      throw new ValidationError('Category name is required');
    }
    
    // Check for duplicate category name
    const existingCategory = await Category.findOne({ name: name.trim() });
    if (existingCategory) {
      throw new ValidationError('Category with this name already exists');
    }
    
    const categoriesCount = await Category.countDocuments();
    
    const newCategory = new Category({
      id: generateId(),
      name: name.trim(),
      sortOrder: categoriesCount + 1,
    });
    
    await newCategory.save();
    
    console.log('✅ Category created successfully:', newCategory.id);
    
    // Return the created category (without image field – client can compute)
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCategory,
    });
  } catch (error) {
    console.error('❌ Error in POST /categories:', error);
    next(error);
  }
});

/**
 * PUT /api/categories/:id
 * Update category
 * Used by: ADMIN
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const categoryId = req.params.id;
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      throw new ValidationError('Category name is required');
    }
    
    const category = await Category.findOne({ id: categoryId });
    if (!category) {
      throw new NotFoundError('Category');
    }
    
    // Check for duplicate name (excluding current category)
    const existingCategory = await Category.findOne({ 
      name: name.trim(), 
      id: { $ne: categoryId } 
    });
    if (existingCategory) {
      throw new ValidationError('Category with this name already exists');
    }
    
    category.name = name.trim();
    await category.save();
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/categories/:id
 * Delete category (and all its menu items)
 * Used by: ADMIN
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const categoryId = req.params.id;
    
    const category = await Category.findOne({ id: categoryId });
    if (!category) {
      throw new NotFoundError('Category');
    }
    
    // Get count of menu items in this category
    const itemCount = await MenuItem.countDocuments({ categoryId: categoryId });
    
    // Delete all menu items in this category
    await MenuItem.deleteMany({ categoryId: categoryId });
    
    // Delete the category
    await Category.deleteOne({ id: categoryId });
    
    res.json({
      success: true,
      message: itemCount > 0 
        ? `Category deleted with ${itemCount} menu items` 
        : 'Category deleted successfully',
      deletedItemsCount: itemCount,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;