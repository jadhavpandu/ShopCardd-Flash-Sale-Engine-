// routes/dealRoutes.js - API Endpoints
const express = require('express');
const router = express.Router();
const dealController = require('../controllers/dealController');
const {
  createDealValidators,
  discoveryValidators,
  claimDealValidators
} = require('../middleware/validators');

/**
 * @route   POST /api/deals
 * @desc    Create a new flash sale deal
 * @access  Public (should be protected in production)
 */
router.post('/deals', createDealValidators, dealController.createDeal);

/**
 * @route   GET /api/deals
 * @desc    Discover nearby active deals
 * @access  Public
 * @query   lat - Latitude (required)
 * @query   long - Longitude (required)
 * @query   radius - Search radius in km (optional, default: 5)
 */
router.get('/deals', discoveryValidators, dealController.discoverDeals);

/**
 * @route   POST /api/deals/:deal_id/claim
 * @desc    Claim a voucher for a deal
 * @access  Public (should be authenticated in production)
 */
router.post('/deals/:deal_id/claim', claimDealValidators, dealController.claimDeal);

module.exports = router;