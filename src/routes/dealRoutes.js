const express = require('express');
const router = express.Router();
const dealController = require('../controllers/dealController');
const {
  createDealValidators,
  discoveryValidators,
  claimDealValidators
} = require('../middleware/validators');


router.post('/deals', createDealValidators, dealController.createDeal);


router.get('/deals', discoveryValidators, dealController.discoverDeals);


router.post('/deals/:deal_id/claim', claimDealValidators, dealController.claimDeal);

module.exports = router;