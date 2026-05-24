/**
 * Datacap Sequence Manager
 * 
 * Manages SequenceNo persistence across transactions
 * SequenceNo must increment and persist between requests
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

class DatacapSequenceManager {
  constructor() {
    this.sequenceNo = null;
    this.sequenceFile = path.join(__dirname, '../data/sequence.json');
    this.ensureDataDir();
    this.loadSequence();
  }

  ensureDataDir() {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  loadSequence() {
    try {
      if (fs.existsSync(this.sequenceFile)) {
        const data = JSON.parse(fs.readFileSync(this.sequenceFile, 'utf8'));
        this.sequenceNo = data.sequenceNo;
        logger.info(`[SequenceManager] Loaded SequenceNo: ${this.sequenceNo}`);
      } else {
        // Initial sequence number for new deployment
        this.sequenceNo = '0010010010';
        this.saveSequence();
        logger.info(`[SequenceManager] Initialized SequenceNo: ${this.sequenceNo}`);
      }
    } catch (error) {
      logger.error(`[SequenceManager] Failed to load sequence: ${error.message}`);
      this.sequenceNo = '0010010010';
    }
  }

  saveSequence() {
    try {
      fs.writeFileSync(this.sequenceFile, JSON.stringify({ sequenceNo: this.sequenceNo }, null, 2));
      logger.debug(`[SequenceManager] Saved SequenceNo: ${this.sequenceNo}`);
    } catch (error) {
      logger.error(`[SequenceManager] Failed to save sequence: ${error.message}`);
    }
  }

  getCurrentSequence() {
    return this.sequenceNo;
  }

  updateSequence(newSequenceNo) {
    if (newSequenceNo && newSequenceNo !== this.sequenceNo) {
      this.sequenceNo = newSequenceNo;
      this.saveSequence();
      logger.info(`[SequenceManager] Updated SequenceNo to: ${this.sequenceNo}`);
    }
  }

  incrementSequence() {
    // Datacap SequenceNo format: 0010010010 (increments in a specific way)
    // For simplicity, we use the value returned by Datacap response
    // This method is a fallback if no response provides new sequence
    const current = parseInt(this.sequenceNo, 10);
    const next = (current + 1).toString().padStart(10, '0');
    this.sequenceNo = next;
    this.saveSequence();
    logger.info(`[SequenceManager] Incremented SequenceNo to: ${this.sequenceNo}`);
    return this.sequenceNo;
  }

  resetSequence() {
    this.sequenceNo = '0010010010';
    this.saveSequence();
    logger.info(`[SequenceManager] Reset SequenceNo to: ${this.sequenceNo}`);
  }
}

module.exports = new DatacapSequenceManager();