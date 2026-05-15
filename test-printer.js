/**
 * Test script for printer integration
 * Run: node test-printer.js
 */

require('dotenv').config();
const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000';

async function testBridgeConnection() {
  console.log('\n🔌 Testing Bridge Connection...');
  try {
    // First, login to get token
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      password: 'tortas2026'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully');
    
    // Test bridge status
    const statusResponse = await axios.get(`${BACKEND_URL}/api/orders/test/bridge-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Bridge Status:', statusResponse.data);
    return true;
  } catch (error) {
    console.error('❌ Bridge connection test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

async function testPrint() {
  console.log('\n🖨️ Testing Print via Backend...');
  try {
    const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      password: 'tortas2026'
    });
    
    const token = loginResponse.data.token;
    
    const testResponse = await axios.get(`${BACKEND_URL}/api/orders/test/print`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Test Print Result:', testResponse.data);
    return true;
  } catch (error) {
    console.error('❌ Test print failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

async function createTestOrder() {
  console.log('\n📝 Creating Test Order...');
  try {
    const testOrder = {
      items: [
        {
          name: 'Torta Ahogada',
          quantity: 2,
          price: 11.99,
          removed: ['cebolla'],
          extras: ['salsa extra']
        },
        {
          name: 'Agua de Jamaica',
          quantity: 2,
          price: 3.00,
          removed: [],
          extras: ['mucho hielo']
        }
      ],
      orderType: 'eat-in',
      notes: 'Cliente quiere todo junto por favor'
    };
    
    const response = await axios.post(`${BACKEND_URL}/api/orders`, testOrder);
    
    console.log('✅ Order created successfully');
    console.log('Order Number:', response.data.data.id);
    console.log('Order Status:', response.data.data.status);
    
    return true;
  } catch (error) {
    console.error('❌ Order creation failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║     BACKEND PRINTER INTEGRATION TESTS      ║');
  console.log('╚════════════════════════════════════════════╝');
  
  console.log('\n⚠️  Make sure:');
  console.log('   1. Backend is running (npm run dev)');
  console.log('   2. Bridge service is running (in other terminal)');
  console.log('   3. Both services are on same network\n');
  
  const bridgeOk = await testBridgeConnection();
  if (!bridgeOk) {
    console.log('\n❌ Cannot proceed - bridge unreachable');
    process.exit(1);
  }
  
  await testPrint();
  await createTestOrder();
  
  console.log('\n✅ All tests completed!');
  console.log('\n💡 Check:');
  console.log('   - Bridge service terminal for print job logs');
  console.log('   - Backend logs for print triggering');
  console.log('   - Check logs/bridge.log for detailed output');
}

runTests().catch(console.error);