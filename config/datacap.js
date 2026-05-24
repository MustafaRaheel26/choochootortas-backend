/**
 * Datacap DC Direct Configuration
 * 
 * Server Communication (HTTPS POST) - No local middleware required
 * Device communicates via Datacap cloud (NETePay Hosted)
 */

require('dotenv').config();

module.exports = {
  // Endpoints
  endpoints: {
    cert: 'https://cloud-test.dcap.com/ProcessEMVTransaction/',
    prod: 'https://trancloud.dsipscs.com/ProcessEMVTransaction/',
    lookup: 'https://trancloud.dsipscs.com/Lookup/',
  },
  
  // Active endpoint (cert for testing, prod for live)
  activeEndpoint: process.env.DATACAP_ENDPOINT === 'prod' 
    ? 'https://trancloud.dsipscs.com/ProcessEMVTransaction/'
    : 'https://cloud-test.dcap.com/ProcessEMVTransaction/',
  
  // Authentication
  accountId: process.env.DATACAP_ACCOUNT_ID,
  authCode: process.env.DATACAP_AUTH_CODE,
  
  // Merchant Settings
  merchantId: process.env.DATACAP_MERCHANT_ID,
  posPackageId: process.env.DATACAP_POS_PACKAGE_ID || 'ChooChooTortas:1.0',
  
  // Device Settings
  tranDeviceId: process.env.DATACAP_TRAN_DEVICE_ID, // Serial number from device label
  secureDevice: 'CloudEMV2', // Always "CloudEMV2" for server communication
  
  // Timeout Settings
  requestTimeoutMs: parseInt(process.env.DATACAP_TIMEOUT_MS) || 300000, // 5 minutes
  inProcessMaxRetries: parseInt(process.env.DATACAP_IN_PROCESS_RETRIES) || 10,
  inProcessRetryDelaySec: parseFloat(process.env.DATACAP_RETRY_DELAY_SEC) || 3.0,
  
  // SequenceNo persistence - stored in database
  sequenceNo: null, // Will be loaded from DB
  
  // EMVParamDownload required flag
  emvParamDownloadRequired: false,
  emvParamDownloadCompleted: false,
};