require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('REPLACE_')) {
    console.warn('⚠️  Placeholder MONGODB_URI detected in .env – please configure your MongoDB Atlas URI for database operations.');
    return;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Server started WITHOUT database – set MONGODB_URI in .env to enable full functionality');
    }
  }
};

module.exports = connectDB;
