require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const dealRoutes = require('./src/routes/dealRoutes');

const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api', dealRoutes);

app.get('/test-redis', async (req, res) => {
  const redis = require('./src/config/redis');
  
  try {
    const ping = await redis.ping();
    await redis.set('test-key', 'Hello from Redis!', 'EX', 60);
    const value = await redis.get('test-key');
    const keys = await redis.keys('*');
    
    res.json({
      status: 'success',
      redis_connected: true,
      ping: ping,
      test_write: 'test-key created',
      test_read: value,
      total_keys: keys.length,
      all_keys: keys.slice(0, 10),
      redis_config: {
        using: process.env.REDIS_URL ? 'REDIS_URL' : 'REDIS_HOST/PORT',
        host: process.env.REDIS_URL ? 
          process.env.REDIS_URL.split('@')[1]?.split(':')[0] : 
          process.env.REDIS_HOST || 'localhost'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      redis_connected: false,
      error: error.message,
      redis_url: process.env.REDIS_URL || 'Not set'
    });
  }
});


app.use((req, res) => {
  res.status(404).json({ 
    status: 'fail', 
    message: 'Route not found' 
  });
});


app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});


mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Flash Sale Engine running on port ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });


process.on('SIGTERM', async () => {
  console.log(' SIGTERM received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = app;