/**
 * Orders Routes - MongoDB Version with Print Job Creation (Polling Architecture)
 *
 * Used by:
 * - KIOSK: POST /api/orders (create order)
 * - KITCHEN: GET /api/orders (fetch all), GET /api/orders/kitchen/live (active orders)
 * - KITCHEN + ADMIN: PUT /api/orders/:id/status (update status)
 * - ADMIN: GET /api/orders (view all orders)
 * - KIOSK: GET /api/orders/next-number (reserve order number for slip)
 *
 * Printer integration: Creates print jobs in MongoDB for bridge to poll.
 * Email integration: Sends receipt email when customer chooses email option.
 *
 * IMPORTANT: Order creation now requires a valid payment session with 'approved' status.
 */

const express = require("express");
const router = express.Router();
const { Order } = require("../models");
const PrintJob = require("../models/PrintJob");
const PaymentSession = require("../models/PaymentSession");
const { authenticateToken } = require("../middleware/auth");
const {
  ValidationError,
  NotFoundError,
} = require("../middleware/errorHandler");
const emailService = require("../services/emailService");

// Logger
let logger = null;
let logPaymentSession = null;

try {
  const loggerModule = require("../utils/logger");
  logger = loggerModule.logger;
  logPaymentSession = loggerModule.logPaymentSession;
} catch (error) {
  logger = {
    info: (...args) => console.log("[INFO]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
  };
  logPaymentSession = {
    orderCreated: (sessionId, orderId, orderNumber) =>
      console.log(`[PAYMENT] ORDER_CREATED: ${sessionId} order:${orderNumber}`),
  };
}

// Debug: Check if Order is loaded
console.log(
  "🔍 routes/orders.js - Order model loaded:",
  typeof Order === "function" ? "✅" : "❌",
);
console.log(
  "🔍 routes/orders.js - PrintJob model loaded:",
  typeof PrintJob === "function" ? "✅" : "❌",
);
console.log(
  "🔍 routes/orders.js - PaymentSession model loaded:",
  typeof PaymentSession === "function" ? "✅" : "❌",
);

// Helper: Get next sequential order number
const getNextOrderNumber = async () => {
  try {
    const lastOrder = await Order.findOne().sort({ createdAt: -1 });
    if (!lastOrder) return 1;
    const lastNumber = parseInt(lastOrder.id.split("_")[1], 10);
    return isNaN(lastNumber) ? 1 : lastNumber + 1;
  } catch (error) {
    console.error("Error getting next order number:", error);
    return 1;
  }
};

// Helper: Create print jobs for kitchen, bar, and customer receipt
const createPrintJobs = async (
  orderId,
  orderNumber,
  orderType,
  items,
  notes,
  subtotal,
  tax,
  totalPrice,
) => {
  const jobs = [];

  // Prepare order data for kitchen/bar (no prices)
  const productionOrderData = {
    orderNumber,
    orderType,
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      removed: item.removed || [],
      extras: item.extras || [],
    })),
    notes: notes || "",
  };

  // Kitchen job
  const kitchenJob = new PrintJob({
    jobId: `${Date.now()}_kitchen_${orderNumber}`,
    type: "kitchen",
    orderId,
    orderNumber,
    orderData: productionOrderData,
    status: "pending",
  });
  jobs.push(kitchenJob.save());

  // Bar job
  const barJob = new PrintJob({
    jobId: `${Date.now()}_bar_${orderNumber}`,
    type: "bar",
    orderId,
    orderNumber,
    orderData: productionOrderData,
    status: "pending",
  });
  jobs.push(barJob.save());

  // Customer receipt job (with prices)
  const receiptOrderData = {
    orderNumber,
    orderType,
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      removed: item.removed || [],
      extras: item.extras || [],
    })),
    subtotal,
    tax,
    totalPrice,
    notes: notes || "",
    timestamp: new Date().toISOString(),
  };

  const receiptJob = new PrintJob({
    jobId: `${Date.now()}_receipt_${orderNumber}`,
    type: "customer",
    orderId,
    orderNumber,
    orderData: receiptOrderData,
    status: "pending",
  });
  jobs.push(receiptJob.save());

  await Promise.all(jobs);

  // Update order with initial print status
  const order = await Order.findOne({ id: orderId });
  if (order) {
    order.printStatus = {
      kitchen: "pending",
      bar: "pending",
      customer: "pending",
      retryCount: 0,
      lastError: null,
      completedAt: null,
    };
    await order.save();
  }

  logger.info(
    `Created print jobs for order #${orderNumber}: kitchen, bar, customer`,
  );
};

// Helper: Send email receipt if customer opted in
const sendEmailReceipt = async (order) => {
  if (order.receiptPreference === "email" && order.customerEmail) {
    try {
      const result = await emailService.sendReceiptEmail(order);
      if (result.success) {
        order.emailSent = true;
        order.emailSentAt = new Date();
        await order.save();
        logger.info(`Email receipt sent for order #${order.id}`);
      } else {
        logger.warn(
          `Email receipt failed for order #${order.id}: ${result.reason || result.error}`,
        );
      }
    } catch (error) {
      logger.error(
        `Email receipt error for order #${order.id}: ${error.message}`,
      );
    }
  } else {
    logger.info(
      `Email receipt skipped for order #${order.id} (preference: ${order.receiptPreference})`,
    );
  }
};

// ==================== GET ROUTES ====================

/**
 * GET /api/orders/next-number
 * Get the next order number WITHOUT creating an order
 */
router.get("/next-number", async (req, res, next) => {
  try {
    const nextNumber = await getNextOrderNumber();
    const orderNumber = nextNumber.toString().padStart(3, "0");
    res.json({
      success: true,
      data: {
        orderNumber: orderNumber,
        orderId: `order_${orderNumber}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders
 * Get all orders (sorted newest first)
 */
router.get("/", async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/kitchen/live
 * Get active orders for kitchen (new, preparing, ready - excludes completed)
 */
router.get("/kitchen/live", async (req, res, next) => {
  try {
    const activeOrders = await Order.find({
      status: { $in: ["new", "preparing", "ready"] },
    }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: activeOrders,
      count: activeOrders.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/:id
 * Get single order by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) {
      throw new NotFoundError("Order");
    }
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/:id/print-status
 * Get print status for a specific order
 */
router.get("/:id/print-status", authenticateToken, async (req, res, next) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) {
      throw new NotFoundError("Order");
    }

    res.json({
      success: true,
      printStatus: order.printStatus || {
        kitchen: "pending",
        bar: "pending",
        customer: "pending",
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== POST ROUTES ====================

/**
 * POST /api/orders
 * Create a new order AFTER payment approval
 *
 * IMPORTANT: Requires valid paymentSessionId in request body
 * Only creates order if payment session exists and status is 'approved'
 */
router.post("/", async (req, res, next) => {
  try {
    const {
      items,
      orderType,
      notes,
      paymentSessionId,
      customerEmail,
      receiptPreference = "print", // 'print', 'email', 'none'
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError("Order must contain at least one item");
    }

    if (!orderType) {
      throw new ValidationError("Order type is required (eat-in or take-out)");
    }

    // Validate payment session (CRITICAL: prevents unpaid orders)
    if (!paymentSessionId) {
      throw new ValidationError(
        "Payment session ID is required. Order must be paid first.",
      );
    }

    // Validate receipt preference
    if (receiptPreference === "email" && !customerEmail) {
      throw new ValidationError(
        "Email is required when choosing email receipt",
      );
    }

    // Find and verify payment session
    const paymentSession = await PaymentSession.findOne({
      sessionId: paymentSessionId,
    });

    if (!paymentSession) {
      throw new ValidationError(
        "Invalid payment session. Please restart checkout.",
      );
    }

    // Check if payment session is already used
    if (paymentSession.orderCreated === true) {
      throw new ValidationError(
        "Order already created for this payment session.",
      );
    }

    // Check payment status
    if (paymentSession.status !== "approved") {
      throw new ValidationError(
        `Cannot create order: Payment status is '${paymentSession.status}'. Payment must be approved first.`,
      );
    }

    // Verify amount matches
    const calculatedTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const taxRate = 8.25;
    const calculatedTax = calculatedTotal * (taxRate / 100);
    const calculatedGrandTotal = calculatedTotal + calculatedTax;

    if (Math.abs(paymentSession.amount - calculatedGrandTotal) > 0.01) {
      logger.warn(
        `Amount mismatch: session $${paymentSession.amount} vs order $${calculatedGrandTotal}`,
      );
      // Don't block, but log for audit
    }

    // Validate each item
    for (const item of items) {
      if (!item.name) {
        throw new ValidationError("Each order item must have a name");
      }
      if (!item.price || item.price <= 0) {
        throw new ValidationError(`Invalid price for item: ${item.name}`);
      }
      if (!item.quantity || item.quantity < 1) {
        throw new ValidationError(`Invalid quantity for item: ${item.name}`);
      }
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const tax = subtotal * (taxRate / 100);
    const totalPrice = subtotal + tax;

    // Get next order number
    const nextNumber = await getNextOrderNumber();
    const orderNumber = nextNumber.toString().padStart(3, "0");
    const orderId = `order_${orderNumber}`;

    // Create order
    const newOrder = new Order({
      id: orderId,
      items: items,
      status: "new",
      orderType: orderType,
      createdAt: new Date(),
      updatedAt: new Date(),
      totalPrice: totalPrice,
      tax: tax,
      subtotal: subtotal,
      paymentSessionId: paymentSessionId,
      paymentTransactionId: paymentSession.datacapTransactionId,
      customerEmail: customerEmail || null,
      receiptPreference: receiptPreference || "print",
    });

    await newOrder.save();

    // Mark payment session as used (prevents duplicate orders)
    paymentSession.orderCreated = true;
    paymentSession.orderId = orderId;
    await paymentSession.save();

    // Log order creation
    logPaymentSession.orderCreated(paymentSessionId, orderId, orderNumber);
    logger.info(
      `Order created after payment approval: #${orderNumber} for session ${paymentSessionId}`,
    );

    // Create print jobs (kitchen, bar, customer) - only if receipt preference is 'print'
    if (receiptPreference === "print") {
      await createPrintJobs(
        orderId,
        orderNumber,
        orderType,
        items,
        notes || "",
        subtotal,
        tax,
        totalPrice,
      );
    } else {
      // If not printing, mark customer print status as completed (skip print)
      const order = await Order.findOne({ id: orderId });
      if (order) {
        order.printStatus.customer = "completed";
        await order.save();
      }
      logger.info(
        `Skipped customer receipt print for order #${orderNumber} (preference: ${receiptPreference})`,
      );
    }

    // Send email receipt if customer opted in
    await sendEmailReceipt(newOrder);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: newOrder,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PUT ROUTES ====================

/**
 * PUT /api/orders/:id/status
 * Update order status
 */
router.put("/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const validStatuses = ["new", "preparing", "ready", "completed"];
    if (!status || !validStatuses.includes(status)) {
      throw new ValidationError(
        `Status must be one of: ${validStatuses.join(", ")}`,
      );
    }

    const order = await Order.findOne({ id: orderId });
    if (!order) {
      throw new NotFoundError("Order");
    }

    order.status = status;
    order.updatedAt = new Date();
    await order.save();

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== TEST ROUTES (Admin only) ====================

/**
 * GET /api/orders/test/create-print-jobs
 * Manually create test print jobs (for debugging)
 */
router.get(
  "/test/create-print-jobs",
  authenticateToken,
  async (req, res, next) => {
    try {
      const testOrderId = `order_999`;
      const testOrderNumber = "999";
      const testItems = [
        {
          name: "Test Item 1",
          quantity: 1,
          price: 10.99,
          removed: [],
          extras: [],
        },
        {
          name: "Test Item 2",
          quantity: 2,
          price: 5.5,
          removed: ["onions"],
          extras: ["cheese"],
        },
      ];

      await createPrintJobs(
        testOrderId,
        testOrderNumber,
        "eat-in",
        testItems,
        "Test notes",
        21.99,
        1.81,
        23.8,
      );

      res.json({ success: true, message: "Test print jobs created" });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
