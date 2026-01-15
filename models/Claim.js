// models/Claim.js - Claim Schema with Voucher Generation
const mongoose = require('mongoose');
//to generate a secure, random, unique voucher code.
const crypto = require('crypto');

const claimSchema = new mongoose.Schema({
  deal_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
    required: true,
    index: true
  },
  user_id: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  voucher_code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  merchant_id: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'redeemed', 'expired'],
    default: 'active',
    index: true
  },
  claimed_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  redeemed_at: {
    type: Date,
    default: null
  },
  expires_at: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
claimSchema.index({ user_id: 1, deal_id: 1 }, { unique: true });
claimSchema.index({ merchant_id: 1, status: 1 });
claimSchema.index({ expires_at: 1 });

// Static method to generate unique voucher code
claimSchema.statics.generateVoucherCode = function(dealId) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  const dealSuffix = dealId.toString().slice(-4).toUpperCase();
  
  return `SHOP-${dealSuffix}-${timestamp}${random}`;
};

// Static method to create a new claim
claimSchema.statics.createClaim = async function(dealId, userId, merchantId, expiresAt) {
  const voucherCode = this.generateVoucherCode(dealId);
  
  const claim = new this({
    deal_id: dealId,
    user_id: userId,
    merchant_id: merchantId,
    voucher_code: voucherCode,
    expires_at: expiresAt
  });
  
  await claim.save();
  return claim;
};

// Instance method to redeem voucher
claimSchema.methods.redeem = async function() {
  if (this.status === 'redeemed') {
    throw new Error('Voucher already redeemed');
  }
  
  if (this.status === 'expired' || this.expires_at < new Date()) {
    throw new Error('Voucher has expired');
  }
  
  this.status = 'redeemed';
  this.redeemed_at = new Date();
  await this.save();
  
  return this;
};

// Pre-save hook to check expiration
claimSchema.pre('save', function(next) {
  if (this.expires_at < new Date() && this.status === 'active') {
    this.status = 'expired';
  }
  next();
});

// Virtual to check if voucher is valid
claimSchema.virtual('is_valid').get(function() {
  return this.status === 'active' && this.expires_at > new Date();
});

const Claim = mongoose.model('Claim', claimSchema);

module.exports = Claim;