/**
 * In-Memory Data Store for Choo Choo Tortas
 * 
 * This is the CENTRAL data source for ALL three apps:
 * - Kiosk (reads menu, creates orders)
 * - Kitchen (reads/updates orders)
 * - Admin (full CRUD on everything)
 * 
 * FUTURE UPGRADE: To switch to MongoDB/PostgreSQL, 
 * just replace the CRUD operations below - API layer stays the same!
 */

// ==================== DATA STRUCTURES ====================

// Categories (matches your admin dashboard structure)
let categories = [
  {
    id: "cat-tortas",
    name: "Tortas",
    sortOrder: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cat-tortas-special",
    name: "Torta Special",
    sortOrder: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cat-tacos",
    name: "Tacos",
    sortOrder: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cat-burritos",
    name: "Burritos",
    sortOrder: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cat-nachos-superfries",
    name: "Nachos & Superfries",
    sortOrder: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cat-platillos",
    name: "Platillos",
    sortOrder: 6,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cat-antojitos",
    name: "Antojitos",
    sortOrder: 7,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cat-drinks",
    name: "Drinks",
    sortOrder: 8,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cat-slushies-fruitcakes",
    name: "Slushies & Fruit Cakes",
    sortOrder: 9,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cat-desserts",
    name: "Desserts",
    sortOrder: 10,
    createdAt: new Date().toISOString(),
  },
];

// Menu Items (sample items - you can expand)
let menuItems = [
  {
    id: "item-torta-chicken",
    itemName: "Torta Chicken",
    price: 11.95,
    description: "Traditional Mexican sandwich with chicken.",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&h=400&fit=crop",
    ingredients: ["Mayo", "Cheese", "Tomatoes", "Beans", "Lettuce", "Onions", "Avocado", "Jalapeño"],
    removeOptions: ["Mayo", "Cheese", "Tomatoes", "Beans", "Lettuce", "Onions", "Avocado", "Jalapeño"],
    extras: [
      { name: "Extra Beans", price: 1.5 },
      { name: "Extra Cilantro", price: 0.5 },
      { name: "Extra Rice & Beans", price: 3.0 }
    ],
    categoryId: "cat-tortas",
    available: true,
    isBestseller: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item-torta-carnitas",
    itemName: "Torta Carnitas",
    price: 11.95,
    description: "Slow-cooked pork carnitas sandwich.",
    image: "https://th.bing.com/th/id/OIP.80zHWCh11LPEx-QFpeHFcQHaFX",
    ingredients: ["Mayo", "Cheese", "Tomatoes", "Beans", "Lettuce", "Onions", "Avocado", "Jalapeño"],
    removeOptions: ["Mayo", "Cheese", "Tomatoes", "Beans", "Lettuce", "Onions", "Avocado", "Jalapeño"],
    extras: [
      { name: "Extra Beans", price: 1.5 },
      { name: "Extra Guacamole", price: 1.5 }
    ],
    categoryId: "cat-tortas",
    available: true,
    isBestseller: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item-torta-pastor",
    itemName: "Torta Pastor",
    price: 11.95,
    description: "Marinated pork with pineapple.",
    image: "https://th.bing.com/th/id/OIP.69aWMSyH9OsPItL-2x6nrwHaJQ",
    ingredients: ["Mayo", "Cheese", "Tomatoes", "Beans", "Lettuce", "Onions", "Avocado", "Jalapeño", "Pineapple"],
    removeOptions: ["Mayo", "Cheese", "Tomatoes", "Beans", "Lettuce", "Onions", "Avocado", "Jalapeño", "Pineapple"],
    extras: [{ name: "Extra Pineapple", price: 1.0 }],
    categoryId: "cat-tortas",
    available: true,
    isBestseller: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item-torta-asada",
    itemName: "Torta Carne Asada",
    price: 11.95,
    description: "Grilled steak sandwich.",
    image: "https://th.bing.com/th/id/OIP.80zHWCh11LPEx-QFpeHFcQHaFX",
    ingredients: ["Mayo", "Cheese", "Tomatoes", "Beans", "Lettuce", "Onions", "Avocado", "Jalapeño"],
    removeOptions: ["Mayo", "Cheese", "Tomatoes", "Beans", "Lettuce", "Onions", "Avocado", "Jalapeño"],
    extras: [{ name: "Extra Steak", price: 3.0 }],
    categoryId: "cat-tortas",
    available: true,
    isBestseller: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item-street-tacos",
    itemName: "4 Street Tacos",
    price: 11.95,
    description: "Cilantro, onions, limes, radish. Choice of meat.",
    image: "https://th.bing.com/th/id/OIP.F9sQ1AzVacKyWW_PdpVeVwHaHa",
    ingredients: ["Onions", "Cilantro", "Limes", "Radish"],
    removeOptions: ["Onions", "Cilantro", "Limes", "Radish"],
    extras: [
      { name: "Shredded Beef", price: 0 },
      { name: "Chicken", price: 0 },
      { name: "Pastor", price: 0 },
      { name: "Asada", price: 0 }
    ],
    categoryId: "cat-tacos",
    available: true,
    isBestseller: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item-quesabirria",
    itemName: "QuesaBirria",
    price: 17.95,
    description: "3 Corn Tortilla Tacos, Shredded Beef and Cheese, Consome, Onions, Cilantro, Rice and Beans",
    image: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop",
    ingredients: ["Shredded Beef", "Cheese", "Onions", "Cilantro", "Rice", "Beans", "Consome"],
    removeOptions: ["Cheese", "Onions", "Cilantro", "Rice", "Beans"],
    extras: [{ name: "Extra Consome", price: 2.0 }],
    categoryId: "cat-tacos",
    available: true,
    isBestseller: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item-regular-burrito",
    itemName: "Regular Burrito",
    price: 11.95,
    description: "Cilantro, Onions, Rice and Beans",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&h=400&fit=crop",
    ingredients: ["Cilantro", "Onions", "Rice", "Beans"],
    removeOptions: ["Cilantro", "Onions", "Rice", "Beans"],
    extras: [
      { name: "Steak", price: 3.0 },
      { name: "Chicken", price: 2.0 },
      { name: "Pastor", price: 2.0 }
    ],
    categoryId: "cat-burritos",
    available: true,
    isBestseller: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item-aguas-frescas",
    itemName: "Aguas Frescas",
    price: 4.5,
    description: "Fresh fruit water. Flavor at pickup time.",
    image: "data:image/webp;base64,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",
    ingredients: ["Fruit", "Water", "Sugar"],
    removeOptions: [],
    extras: [{ name: "32oz Size (+1.00)", price: 1.0 }],
    categoryId: "cat-drinks",
    available: true,
    isBestseller: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item-tres-leches",
    itemName: "3 Leches Cake",
    price: 7.0,
    description: "Traditional sponge cake soaked in three milks.",
    image: "https://static.vecteezy.com/system/resources/previews/059/480/005/non_2x/delicious-isolated-mexican-tres-leches-dessert-with-fluffy-cream-topping-png.png",
    ingredients: ["Sponge Cake", "Evaporated Milk", "Condensed Milk", "Heavy Cream"],
    removeOptions: [],
    extras: [{ name: "Extra Strawberry Syrup", price: 1.0 }],
    categoryId: "cat-desserts",
    available: true,
    isBestseller: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Orders (matches your kitchen dashboard structure)
// Starting with sequential order numbers 001, 002, 003
let orders = [
  {
    id: "order_001",
    items: [
      {
        name: "Torta Chicken",
        quantity: 2,
        removed: ["Onions"],
        extras: ["Extra Cheese"],
        price: 11.95,
      },
      {
        name: "Coca Cola",
        quantity: 1,
        removed: [],
        extras: [],
        price: 2.95,
      },
    ],
    status: "new",
    orderType: "eat-in",
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    totalPrice: 26.85,
    tax: 2.15,
    subtotal: 24.70,
  },
  {
    id: "order_002",
    items: [
      {
        name: "Beef Burrito",
        quantity: 1,
        removed: [],
        extras: ["Sour Cream", "Jalapenos"],
        price: 14.95,
      },
    ],
    status: "preparing",
    orderType: "take-out",
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60000).toISOString(),
    totalPrice: 14.95,
    tax: 1.20,
    subtotal: 13.75,
  },
  {
    id: "order_003",
    items: [
      {
        name: "Fish Tacos (3pc)",
        quantity: 1,
        removed: ["Cilantro"],
        extras: [],
        price: 17.95,
      },
    ],
    status: "ready",
    orderType: "eat-in",
    createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    totalPrice: 17.95,
    tax: 1.44,
    subtotal: 16.51,
  },
];

// Restaurant Settings (matches your admin settings page)
let settings = {
  id: "settings_1",
  name: "Choo Choo Tortas",
  address: "123 Railway Ave, Flavor Town, FT 54321",
  phone: "(555) 123-4567",
  email: "hello@choochootortas.com",
  taxRate: 8.25,
  currency: "USD",
  currencySymbol: "$",
  updatedAt: new Date().toISOString(),
};

// ==================== HELPER FUNCTIONS ====================

// Generate unique ID for menu items and categories
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// ==================== ORDER NUMBERING SYSTEM (FIXED) ====================

// Get the highest order number from existing orders
const getHighestOrderNumber = () => {
  if (orders.length === 0) return 0;
  
  let maxNumber = 0;
  for (const order of orders) {
    const match = order.id.match(/order_(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    }
  }
  return maxNumber;
};

// Get next order number WITHOUT incrementing (for slip preview)
// This does NOT modify any state, just calculates what the next number should be
const getNextOrderNumber = () => {
  const highestNumber = getHighestOrderNumber();
  const nextNumber = highestNumber + 1;
  const orderNumber = nextNumber.toString().padStart(3, '0');
  return {
    orderNumber: orderNumber,
    orderId: `order_${orderNumber}`
  };
};

// Reserve and get next order number (for actual order creation)
// This function DOES NOT store anything, just returns the correct next number
// The actual order creation will use the same logic
const reserveAndGetNextOrderNumber = () => {
  // Same as getNextOrderNumber - we don't store state separately
  // This ensures slip and actual order use the SAME number
  return getNextOrderNumber();
};

// ==================== CATEGORY CRUD ====================

const getAllCategories = () => {
  return [...categories];
};

const getCategoryById = (id) => {
  return categories.find(c => c.id === id);
};

const createCategory = (categoryData) => {
  const newCategory = {
    id: generateId(),
    name: categoryData.name,
    sortOrder: categories.length + 1,
    createdAt: new Date().toISOString(),
  };
  categories.push(newCategory);
  return newCategory;
};

const updateCategory = (id, updates) => {
  const index = categories.findIndex(c => c.id === id);
  if (index === -1) return null;
  categories[index] = {
    ...categories[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return categories[index];
};

const deleteCategory = (id) => {
  const index = categories.findIndex(c => c.id === id);
  if (index === -1) return false;
  // Also delete all menu items in this category
  menuItems = menuItems.filter(item => item.categoryId !== id);
  categories.splice(index, 1);
  return true;
};

// ==================== MENU ITEM CRUD ====================

const getAllMenuItems = () => {
  return [...menuItems];
};

const getMenuItemsByCategory = (categoryId) => {
  return menuItems.filter(item => item.categoryId === categoryId);
};

const getMenuItemById = (id) => {
  return menuItems.find(item => item.id === id);
};

const createMenuItem = (itemData) => {
  const newItem = {
    id: generateId(),
    ...itemData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  menuItems.push(newItem);
  return newItem;
};

const updateMenuItem = (id, updates) => {
  const index = menuItems.findIndex(item => item.id === id);
  if (index === -1) return null;
  menuItems[index] = {
    ...menuItems[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return menuItems[index];
};

const deleteMenuItem = (id) => {
  const index = menuItems.findIndex(item => item.id === id);
  if (index === -1) return false;
  menuItems.splice(index, 1);
  return true;
};

const toggleMenuItemAvailability = (id, available) => {
  const index = menuItems.findIndex(item => item.id === id);
  if (index === -1) return null;
  menuItems[index].available = available;
  menuItems[index].updatedAt = new Date().toISOString();
  return menuItems[index];
};

// ==================== ORDER CRUD ====================

const getAllOrders = () => {
  // Sort by createdAt descending (newest first)
  return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const getOrdersByStatus = (status) => {
  return orders.filter(order => order.status === status);
};

// Get active orders for kitchen (new, preparing, ready - excluding completed)
const getActiveOrders = () => {
  return orders.filter(order => order.status !== 'completed')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const getOrderById = (id) => {
  return orders.find(order => order.id === id);
};

const createOrder = (orderData) => {
  const calculateTax = (subtotal, taxRate) => {
    return subtotal * (taxRate / 100);
  };

  const subtotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  // IMPORTANT: Use the CURRENT tax rate from settings
  const currentTaxRate = settings.taxRate;
  const tax = calculateTax(subtotal, currentTaxRate);
  
  // ALWAYS calculate the next order number based on existing orders
  const highestNumber = getHighestOrderNumber();
  const nextNumber = highestNumber + 1;
  const orderNumber = nextNumber.toString().padStart(3, '0');
  
  const newOrder = {
    id: `order_${orderNumber}`,
    items: orderData.items,
    status: "new",
    orderType: orderData.orderType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalPrice: subtotal + tax,
    tax: tax,
    subtotal: subtotal,
  };
  
  orders.unshift(newOrder);
  return newOrder;
};

const updateOrderStatus = (id, status) => {
  const index = orders.findIndex(order => order.id === id);
  if (index === -1) return null;
  orders[index].status = status;
  orders[index].updatedAt = new Date().toISOString();
  return orders[index];
};

// ==================== SETTINGS CRUD ====================

const getSettings = () => {
  return { ...settings };
};

const updateSettings = (updates) => {
  settings = {
    ...settings,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return { ...settings };
};

// ==================== REPORT FUNCTIONS ====================

const getSalesReport = (startDate, endDate) => {
  // Filter orders by date range
  let filteredOrders = [...orders];
  
  if (startDate && endDate) {
    filteredOrders = filteredOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }
  
  // IMPORTANT: For financial reports, ONLY count COMPLETED orders
  // Because only completed orders represent actual revenue
  const completedOrders = filteredOrders.filter(o => o.status === 'completed');
  
  // Calculate totals from COMPLETED orders only
  const totalSales = completedOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
  const taxCollected = completedOrders.reduce((sum, order) => sum + (order.tax || 0), 0);
  const totalOrders = completedOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  
  // Get current tax rate from settings (this is the key fix)
  const currentTaxRate = settings.taxRate;
  
  // Calculate dine-in and takeout totals from COMPLETED orders only
  const dineInOrders = completedOrders.filter(o => o.orderType === 'eat-in');
  const takeOutOrders = completedOrders.filter(o => o.orderType === 'take-out');
  const dineInTotal = dineInOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const takeOutTotal = takeOutOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const dineInCount = dineInOrders.length;
  const takeOutCount = takeOutOrders.length;
  
  // Calculate items sold by category from COMPLETED orders only
  const itemsSoldByCategory = categories.map(cat => {
    let count = 0;
    let revenue = 0;
    
    completedOrders.forEach(order => {
      order.items.forEach(orderItem => {
        const menuItem = menuItems.find(mi => mi.itemName === (orderItem.name || orderItem.itemName));
        if (menuItem && menuItem.categoryId === cat.id) {
          count += orderItem.quantity;
          revenue += (orderItem.price || 0) * orderItem.quantity;
        }
      });
    });
    
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      count: count,
      revenue: revenue,
    };
  }).filter(cat => cat.count > 0 || cat.revenue > 0);
  
  // Recent sales for date range from COMPLETED orders only
  const recentSales = [];
  const daysToShow = 7;
  for (let i = daysToShow - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    
    const dayOrders = completedOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= date && orderDate < nextDate;
    });
    
    const daySales = dayOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    
    recentSales.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      fullDate: date.toISOString().split('T')[0],
      amount: daySales,
      orders: dayOrders.length,
    });
  }
  
  return {
    totalSales,
    taxCollected,
    totalOrders,
    avgOrderValue,
    currentTaxRate,
    dineInTotal,
    takeOutTotal,
    dineInCount,
    takeOutCount,
    itemsSoldByCategory,
    recentSales,
  };
};

// ==================== EXPORT ALL FUNCTIONS ====================

module.exports = {
  // Categories
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  
  // Menu Items
  getAllMenuItems,
  getMenuItemsByCategory,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
  
  // Orders
  getAllOrders,
  getOrdersByStatus,
  getActiveOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  
  // Order Number Reservation (now based on actual orders, not stored counter)
  reserveAndGetNextOrderNumber,
  getNextOrderNumber,
  
  // Settings
  getSettings,
  updateSettings,
  
  // Reports
  getSalesReport,
};