const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectTestDatabase = async () => {
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoServer.getUri());
};

const disconnectTestDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

const stopTestDatabase = async () => {
  await disconnectTestDatabase();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = undefined;
  }
};

module.exports = { connectTestDatabase, disconnectTestDatabase, stopTestDatabase };
