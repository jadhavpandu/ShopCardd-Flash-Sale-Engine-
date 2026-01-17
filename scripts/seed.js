
require('dotenv').config({ path: '../.env' });

const mongoose = require('mongoose');
const Deal = require('../models/Deal');
const Claim = require('../models/Claim');
const redis = require('../config/redis');


const sampleDeals = [
  {
    merchant_id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Flat 50% Off on Grilled Sandwiches',
    total_vouchers: 100,
    inventory_remaining: 100,
    valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    location: {
      type: 'Point',
      coordinates: [72.8777, 19.0760] 
    }
  },
  {
    merchant_id: 'merchant-gadget-zone-001',
    title: '20% OFF [iPhone 15 Claim Sale]',
    total_vouchers: 50,
    inventory_remaining: 5,
    valid_until: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    location: {
      type: 'Point',
      coordinates: [72.8777, 19.0780] 
    }
  },
  {
    merchant_id: 'merchant-gadget-zone-001',
    title: 'DSLR Camera 30% Off - Expired Deal',
    total_vouchers: 50,
    inventory_remaining: 50,
    valid_until: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    location: {
      type: 'Point',
      coordinates: [72.8800, 19.0750]
    }
  },
  {
    merchant_id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Free Iced Tea (Expired)',
    total_vouchers: 50,
    inventory_remaining: 10,
    valid_until: new Date('2023-12-01T00:00:00Z'),
    location: {
      type: 'Point',
      coordinates: [77.2090, 28.6139] 
    }
  },
  {
    merchant_id: 'merchant-delhi-brunch-002',
    title: 'Delhi Brunch Grand Opening',
    total_vouchers: 10,
    inventory_remaining: 10,
    valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    location: {
      type: 'Point',
      coordinates: [77.1025, 28.7041]
    }
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flash-sale');
    console.log('Connected to MongoDB');


    await Deal.deleteMany({});
    await Claim.deleteMany({});
    console.log('Cleared existing data');


    await redis.flushdb();
    console.log('Cleared Redis cache');

  
    const deals = await Deal.insertMany(sampleDeals);
    console.log(`Inserted ${deals.length} deals`);

 
    let cachedCount = 0;
    for (const deal of deals) {
      if (deal.valid_until > new Date()) {
        const ttl = Math.floor((deal.valid_until - Date.now()) / 1000);
        
        await redis.setex(
          `deal:${deal._id}`,
          ttl,
          JSON.stringify({
            merchant_id: deal.merchant_id,
            title: deal.title,
            total_vouchers: deal.total_vouchers,
            inventory_remaining: deal.inventory_remaining,
            valid_until: deal.valid_until,
            location: deal.location
          })
        );

        await redis.setex(
          `deal:${deal._id}:inventory`,
          ttl,
          deal.inventory_remaining
        );

        cachedCount++;
      }
    }
    console.log(`Cached ${cachedCount} active deals in Redis`);

    
    const activeDeals = deals.filter(d => d.valid_until > new Date());
    const expiredDeals = deals.filter(d => d.valid_until <= new Date());

    console.log('\n Seed Summary:');
    console.log('================');
    console.log(`Total Deals: ${deals.length}`);
    console.log(`Active Deals: ${activeDeals.length}`);
    console.log(`Expired Deals: ${expiredDeals.length}`);

    console.log('\nActive Deals:');
    activeDeals.forEach(d => {
      const [lng, lat] = d.location.coordinates;
      console.log(`  ${d.title}`);
      console.log(`     Location: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`);
      console.log(`     Inventory: ${d.inventory_remaining}/${d.total_vouchers}`);
    });

    console.log('\nSeeding completed successfully!');
    console.log('\n Test the API:');
    console.log('   curl "http://localhost:3000/api/deals?lat=19.0760&long=72.8777&radius=5"');

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.connection.close();
    redis.disconnect();
    console.log('\n Disconnected from databases');
  }
}

seed();