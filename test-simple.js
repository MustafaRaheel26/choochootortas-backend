/**
 * Simple printer test - no authentication needed
 * Run: node test-simple.js
 */

require('dotenv').config();
const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000';

async function testHealth() {
  console.log('\n📡 Testing Backend Health...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`);
    console.log('✅ Backend is running');
    console.log('   Status:', response.data.message);
    return true;
  } catch (error) {
    console.error('❌ Backend not reachable:', error.message);
    return false;
  }
}

async function createOrder() {
  console.log('\n📝 Creating Test Order...');
  try {
    const testOrder = {
      items: [
        {
          name: 'Torta de Pollo',
          quantity: 2,
          price: 10.99,
          removed: ['cebolla', 'tomate'],
          extras: ['queso extra']
        },
        {
          name: 'Coca Cola',
          quantity: 1,
          price: 2.50,
          removed: [],
          extras: []
        }
      ],
      orderType: 'eat-in',
      notes: 'Printer test order - no prices on ticket'
    };
    
    const response = await axios.post(`${BACKEND_URL}/api/orders`, testOrder);
    
    console.log('✅ Order created successfully!');
    console.log('   Order Number:', response.data.data.id);
    console.log('   Order Type:', response.data.data.orderType);
    console.log('   Items:', response.data.data.items.length);
    
    return true;
  } catch (error) {
    console.error('❌ Order creation failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    return false;
  }
}

async function runTest() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║     SIMPLE PRINTER INTEGRATION TEST        ║');
  console.log('╚════════════════════════════════════════════╝');
  
  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('\n❌ Backend not running. Start it with: npm run dev');
    process.exit(1);
  }
  
  await createOrder();
  
  console.log('\n✅ Test completed!');
  console.log('\n📋 Check these:');
  console.log('   1. Bridge terminal - Should show print attempt');
  console.log('   2. Backend terminal - Should show print trigger');
  console.log('   3. Check logs/bridge.log for details');
}

runTest();