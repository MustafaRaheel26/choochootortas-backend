/**
 * Test MongoDB Connection and Models
 * Run: node test-mongo.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://restaurant_admin:tortas2026@choochootortas.vg0nioj.mongodb.net/restaurant_db?retryWrites=true&w=majority&appName=ChooChooTortas';

console.log('🔍 Testing MongoDB Connection...');
console.log('📡 URI:', MONGODB_URI.replace(/tortas2026/g, '***HIDDEN***'));

async function testConnection() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB Connected Successfully!');
    console.log('📊 Database:', mongoose.connection.name);
    
    // Define a simple test schema
    const testSchema = new mongoose.Schema({
      name: String,
      createdAt: { type: Date, default: Date.now }
    });
    
    const TestModel = mongoose.model('Test', testSchema);
    
    // Test creating a document
    const testDoc = new TestModel({ name: 'test' });
    await testDoc.save();
    console.log('✅ Successfully saved a test document');
    
    // Test finding documents
    const found = await TestModel.find();
    console.log('✅ Successfully found documents:', found.length);
    
    // Clean up
    await TestModel.deleteMany({});
    console.log('✅ Cleaned up test documents');
    
    console.log('\n🎉 MongoDB is working perfectly!');
    console.log('The issue is in your model exports or route imports.');
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ MongoDB Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testConnection();