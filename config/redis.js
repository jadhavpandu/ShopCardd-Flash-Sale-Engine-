const Redis = require('ioredis');

let redis;

if (process.env.REDIS_URL) {
  console.log('Using REDIS_URL for Redis connection');
  
 
  const isSecure = process.env.REDIS_URL.startsWith('rediss://');
  
  const redisOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
    retryStrategy(times) {
      if (times > 10) {
        console.log('Redis connection failed after 10 retries');
        return null; 
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    }
  };


  if (isSecure) {
    redisOptions.tls = {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
      
      minVersion: 'TLSv1',
      maxVersion: 'TLSv1.3'
    };
    console.log('Using secure Redis connection (TLS)');
  }
  
  redis = new Redis(process.env.REDIS_URL, redisOptions);
} else {
  
  console.log('Using REDIS_HOST and REDIS_PORT for Redis connection');
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });
}


redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('ready', () => {
  console.log('Redis ready to accept commands');
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

redis.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

redis.on('close', () => {
  console.log('Redis connection closed');
});


process.on('SIGTERM', async () => {
  await redis.quit();
  console.log('Redis connection closed');
});

module.exports = redis;