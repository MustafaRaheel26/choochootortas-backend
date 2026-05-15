/**
 * Test polling architecture
 * Run: node test-polling.js
 */

require('dotenv').config();
const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000';

async function createTestOrder() {
  console.log('\n📝 Creating test order...');
  
  const testOrder = {
    items: [
      {
        name: 'Torta Cubana Test',
        quantity: 2,
        price: 12.99,
        removed: ['cebolla', 'tomate'],
        extras: ['queso extra', 'aguacate']
      },
      {
        name: 'Coca Cola',
        quantity: 1,
        price: 3.00,
        removed: [],
        extras: ['mucho hielo']
      }
    ],
    orderType: 'eat-in',
    notes: 'Orden de prueba - sistema de polling'
  };
  
  try {
    const response = await axios.post(`${BACKEND_URL}/api/orders`, testOrder);
    console.log('✅ Order created!');
    console.log('   Order Number:', response.data.data.id);
    console.log('   Status:', response.data.data.status);
    return true;
  } catch (error) {
    console.error('❌ Failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    return false;
  }
}

async function checkPrintJobs() {
  console.log('\n📋 Checking print jobs...');
  
  try {
    const response = await axios.get(`${BACKEND_URL}/api/print-jobs/pending`, {
      headers: { 'X-API-Key': 'dev-bridge-key-12345' }
    });
    
    console.log(`   Pending jobs: ${response.data.count}`);
    
    if (response.data.jobs.length > 0) {
      response.data.jobs.forEach(job => {
        console.log(`   - ${job.jobId}: ${job.type} (order #${job.orderNumber})`);
      });
    }
    
    return response.data.count;
  } catch (error) {
    console.error('❌ Failed to check jobs:', error.message);
    return 0;
  }
}

async function runTest() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║     POLLING ARCHITECTURE TEST              ║');
  console.log('╚════════════════════════════════════════════╝');
  
  console.log('\n⚠️  Make sure:');
  console.log('   1. Backend is running (Terminal 1)');
  console.log('   2. Bridge is running (Terminal 2)');
  console.log('   3. Both show no errors\n');
  
  // Create order
  await createTestOrder();
  
  // Wait a moment for bridge to poll
  console.log('\n⏳ Waiting 3 seconds for bridge to poll...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check print jobs (should be 0 if bridge processed them)
  const pending = await checkPrintJobs();
  
  if (pending === 0) {
    console.log('\n✅ SUCCESS! Bridge processed all print jobs.');
    console.log('   Kitchen/Bar jobs should have attempted to print');
    console.log('   Customer receipt job should have attempted to print');
  } else {
    console.log(`\n⚠️ ${pending} jobs still pending. Check bridge logs.`);
  }
  
  console.log('\n📋 Check Terminal 2 (Bridge) for print attempts.');
  console.log('   (They will fail because no real printers - that\'s OK)\n');
}

runTest();