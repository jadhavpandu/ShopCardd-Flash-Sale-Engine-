const mongoose = require('mongoose');
const Deal = require('../models/Deal');
const Claim = require('../models/Claim');
const redis = require('../config/redis');
const createDeal = async (req, res) => {
  try {
    const { merchant_id, title, total_vouchers, valid_until, location } = req.body;

  
    const deal = new Deal({
      merchant_id,
      title,
      total_vouchers,
      inventory_remaining: total_vouchers,
      valid_until: new Date(valid_until),
      location: {
        type: 'Point',
        coordinates: [location.lng, location.lat]
      }
    });

    await deal.save();

    
    const ttl = Math.floor((new Date(valid_until) - Date.now()) / 1000);
    
    if (ttl > 0) {
      const dealData = {
        merchant_id: deal.merchant_id,
        title: deal.title,
        total_vouchers: deal.total_vouchers,
        inventory_remaining: deal.inventory_remaining,
        valid_until: deal.valid_until,
        location: deal.location
      };

      await Promise.all([
        redis.setex(`deal:${deal._id}`, ttl, JSON.stringify(dealData)),
        redis.setex(`deal:${deal._id}:inventory`, ttl, deal.inventory_remaining)
      ]);
    }

    res.status(201).json({
      status: 'success',
      deal_id: deal._id,
      message: 'Deal created successfully',
      data: {
        merchant_id: deal.merchant_id,
        title: deal.title,
        total_vouchers: deal.total_vouchers,
        valid_until: deal.valid_until,
        location: {
          lat: location.lat,
          lng: location.lng
        }
      }
    });

  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create deal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (degrees) => degrees * (Math.PI / 180);

const discoverDeals = async (req, res) => {
  try {
    const { lat, long, radius = 5 } = req.query;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(long);
    const radiusKm = parseInt(radius);

    const cacheKey = `discovery:${latitude}:${longitude}:${radiusKm}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json({
        status: 'success',
        source: 'cache',
        ...JSON.parse(cached)
      });
    }

  
    const deals = await Deal.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radiusKm * 1000
        }
      },
      valid_until: { $gt: new Date() },
      inventory_remaining: { $gt: 0 }
    })
    .select('merchant_id title total_vouchers inventory_remaining valid_until location')
    .limit(50)
    .lean();

    
    const enrichedDeals = deals.map(deal => {
      const [dealLng, dealLat] = deal.location.coordinates;
      const distance_km = calculateDistance(latitude, longitude, dealLat, dealLng);
      
      return {
        deal_id: deal._id,
        merchant_id: deal.merchant_id,
        title: deal.title,
        total_vouchers: deal.total_vouchers,
        inventory_remaining: deal.inventory_remaining,
        valid_until: deal.valid_until,
        location: {
          lat: dealLat,
          lng: dealLng
        },
        distance_km: parseFloat(distance_km.toFixed(2))
      };
    });

    const response = {
      status: 'success',
      count: enrichedDeals.length,
      deals: enrichedDeals
    };

   
    await redis.setex(cacheKey, 30, JSON.stringify({
      count: enrichedDeals.length,
      deals: enrichedDeals
    }));

    res.json(response);

  } catch (error) {
    console.error('Error discovering deals:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to discover deals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



const claimDeal = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    const { deal_id } = req.params;
    const { user_id } = req.body;

    
    const luaScript = `
      local inventory_key = KEYS[1]
      local claimed_key = KEYS[2]
      local user_id = ARGV[1]
      
      -- Check if user already claimed
      if redis.call('SISMEMBER', claimed_key, user_id) == 1 then
        return -1
      end
      
      -- Try to decrement inventory atomically
      local remaining = redis.call('DECR', inventory_key)
      
      if remaining < 0 then
        redis.call('INCR', inventory_key)
        return 0
      end
      
      -- Add user to claimed set
      redis.call('SADD', claimed_key, user_id)
      return 1
    `;

    const result = await redis.eval(
      luaScript,
      2,
      inventoryKey,
      claimedKey,
      user_id
    );

 
    if (result === -1) {
      return res.status(400).json({
        status: 'fail',
        reason: 'User already claimed'
      });
    }

    if (result === 0) {
      return res.status(409).json({
        status: 'fail',
        reason: 'Deal Sold Out'
      });
    }

    
    await session.withTransaction(async () => {
      const deal = await Deal.findById(deal_id).session(session);

      if (!deal) {
        throw new Error('Deal not found');
      }

      if (deal.inventory_remaining <= 0) {
        throw new Error('Sold out');
      }

      if (deal.claimed_by.includes(user_id)) {
        throw new Error('Already claimed');
      }

      if (deal.valid_until < new Date()) {
        throw new Error('Deal expired');
      }

   
      deal.inventory_remaining -= 1;
      deal.claimed_by.push(user_id);
      await deal.save({ session });

      await Claim.createClaim(
        deal._id,
        user_id,
        deal.merchant_id,
        deal.valid_until
      );
    });


    const voucher_code = Claim.generateVoucherCode(deal_id);

    res.status(200).json({
      status: 'success',
      voucher_code,
      message: 'Deal claimed successfully'
    });

  } catch (error) {
    console.error('Error claiming deal:', error);
    
    if (error.message === 'Already claimed') {
      return res.status(400).json({
        status: 'fail',
        reason: 'User already claimed'
      });
    }
    
    if (error.message === 'Sold out') {
      return res.status(409).json({
        status: 'fail',
        reason: 'Deal Sold Out'
      });
    }

    if (error.message === 'Deal expired') {
      return res.status(400).json({
        status: 'fail',
        reason: 'Deal has expired'
      });
    }

    if (error.message === 'Deal not found') {
      return res.status(404).json({
        status: 'fail',
        reason: 'Deal not found'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to claim deal',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    
  } finally {
    session.endSession();
  }
};

module.exports = {
  createDeal,
  discoverDeals,
  claimDeal
};