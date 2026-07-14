/**
 * Email Service - Sends receipt emails to customers
 *
 * Uses Nodemailer with SMTP configuration
 * Supports any SMTP provider (Gmail, Network Solutions, etc.)
 */

const nodemailer = require("nodemailer");
const { logger } = require("../utils/logger");

class EmailService {
  constructor() {
    // SMTP configuration from environment variables
    this.smtpHost = process.env.SMTP_HOST;
    this.smtpPort = parseInt(process.env.SMTP_PORT) || 587;
    this.smtpSecure = process.env.SMTP_SECURE === "true";
    this.smtpUser = process.env.SMTP_USER;
    this.smtpPass = process.env.SMTP_PASS;
    this.fromEmail = process.env.FROM_EMAIL || this.smtpUser;
    this.fromName = process.env.FROM_NAME || "Choo Choo Tortas";

    this.enabled = this.smtpHost && this.smtpUser && this.smtpPass;

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpSecure,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });
      logger.info(`Email service configured: ${this.smtpHost}`);
    } else {
      logger.warn("Email service disabled - missing SMTP configuration");
    }
  }

  /**
   * Generate receipt email HTML
   */
  generateReceiptHtml(order) {
    const orderNumber = order.id.split("_")[1] || order.id;
    const date = new Date(order.createdAt);

    const itemsHtml = order.items
      .map((item) => {
        let itemHtml = `
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid #eee;">
            ${item.quantity}x ${item.name}
          </td>
          <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right;">
            $${(item.price * item.quantity).toFixed(2)}
          </td>
        </tr>
      `;

        if (item.removed && item.removed.length > 0) {
          itemHtml += `
          <tr>
            <td colspan="2" style="padding:0 0 8px 20px; font-size:12px; color:#888;">
              Sin: ${item.removed.join(", ")}
            </td>
          </tr>
        `;
        }

        if (item.extras && item.extras.length > 0) {
          itemHtml += `
          <tr>
            <td colspan="2" style="padding:0 0 8px 20px; font-size:12px; color:#888;">
              + ${item.extras.join(", ")}
            </td>
          </tr>
        `;
        }

        return itemHtml;
      })
      .join("");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Receipt #${orderNumber}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="text-align: center; border-bottom: 3px solid #e74c3c; padding-bottom: 20px; margin-bottom: 20px;">
      <h1 style="font-size: 28px; font-weight: 900; margin: 0; color: #1a1a1a; letter-spacing: 1px;">
        CHOO CHOO TORTAS
      </h1>
      <p style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 5px 0 0 0;">
        Official Order Invoice
      </p>
    </div>

    <!-- Order Info -->
    <div style="background-color: #f5f5f5; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td><strong>Order ID</strong></td>
          <td style="text-align: right;">#${orderNumber}</td>
        </tr>
        <tr>
          <td><strong>Date</strong></td>
          <td style="text-align: right;">${date.toLocaleDateString()}</td>
        </tr>
        <tr>
          <td><strong>Time</strong></td>
          <td style="text-align: right;">${date.toLocaleTimeString()}</td>
        </tr>
        <tr>
          <td><strong>Type</strong></td>
          <td style="text-align: right; text-transform: uppercase;">${order.orderType === "eat-in" ? "EAT IN" : "TAKE OUT"}</td>
        </tr>
      </table>
    </div>

    <!-- Items -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <thead>
        <tr style="border-bottom: 2px solid #ddd;">
          <th style="text-align: left; padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #888;">Item & Description</th>
          <th style="text-align: right; padding: 8px 0; font-size: 12px; text-transform: uppercase; color: #888;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <div style="border-top: 3px solid #ddd; padding-top: 15px;">
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td>Subtotal</td>
          <td style="text-align: right;">$${order.subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Tax (8.25%)</td>
          <td style="text-align: right;">$${order.tax.toFixed(2)}</td>
        </tr>
        <tr style="font-size: 18px; font-weight: bold;">
          <td style="padding-top: 10px; border-top: 2px solid #333;">TOTAL</td>
          <td style="padding-top: 10px; border-top: 2px solid #333; text-align: right; color: #e74c3c;">
            $${order.totalPrice.toFixed(2)}
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 3px solid #e74c3c; padding-top: 20px; margin-top: 20px;">
      <p style="font-size: 16px; font-weight: bold; margin: 0;">Thank you!</p>
      <p style="color: #888; font-size: 12px; margin: 5px 0 0 0;">Your order is being prepared</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Send receipt email
   */
  async sendReceiptEmail(order) {
    if (!this.enabled) {
      logger.warn("Email service disabled - receipt not sent");
      return { success: false, reason: "Email service disabled" };
    }

    if (!order.customerEmail) {
      logger.warn("No customer email provided for order:", order.id);
      return { success: false, reason: "No customer email" };
    }

    if (order.receiptPreference === "none") {
      logger.info(`Customer declined receipt for order #${order.id}`);
      return { success: true, reason: "Customer declined receipt" };
    }

    try {
      const orderNumber = order.id.split("_")[1] || order.id;
      const html = this.generateReceiptHtml(order);

      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: order.customerEmail,
        subject: `Your Order Receipt #${orderNumber} - Choo Choo Tortas`,
        html: html,
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info(
        `Receipt email sent to ${order.customerEmail} for order #${orderNumber}`,
      );

      return {
        success: true,
        messageId: info.messageId,
        to: order.customerEmail,
      };
    } catch (error) {
      logger.error(`Failed to send receipt email: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if email service is configured
   */
  isConfigured() {
    return this.enabled;
  }
}

// Singleton instance
const emailService = new EmailService();
module.exports = emailService;
