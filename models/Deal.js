// models/Deal.js - Deal Schema with Geospatial Index
// adding the schema using mongoose


const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  merchant_id: {
    type: String,
    required: [true, 'Merchant ID is required'],
    index: true,
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Deal title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  total_vouchers: {
    type: Number,
    required: [true, 'Total vouchers is required'],
    min: [1, 'Total vouchers must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Total vouchers must be an integer'
    }
  },
  inventory_remaining: {
    type: Number,
    required: [true, 'Inventory remaining is required'],
    min: [0, 'Inventory cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Inventory must be an integer'
    }
  },
  valid_until: {
    type: Date,
    required: [true, 'Expiration date is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Expiration date must be in the future'
    }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Invalid coordinates format [longitude, latitude]'
      }
    }
  },
  claimed_by: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
dealSchema.index({ location: '2dsphere' });
dealSchema.index({ valid_until: 1 });
dealSchema.index({ merchant_id: 1, valid_until: 1 });
dealSchema.index({ inventory_remaining: 1, valid_until: 1 });

// Virtual for checking if deal is active
dealSchema.virtual('is_active').get(function() {
  return this.valid_until > new Date() && this.inventory_remaining > 0;
});

// Pre-save validation
dealSchema.pre('save', function(next) {
  if (this.inventory_remaining > this.total_vouchers) {
    next(new Error('Inventory remaining cannot exceed total vouchers'));
  }
  next();
});

// Static method to find active deals
dealSchema.statics.findActive = function() {
  return this.find({
    valid_until: { $gt: new Date() },
    inventory_remaining: { $gt: 0 }
  });
};

// Static method for geospatial search
dealSchema.statics.findNearby = function(longitude, latitude, radiusInKm, options = {}) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusInKm * 1000 // Convert km to meters
      }
    },
    valid_until: { $gt: new Date() },
    inventory_remaining: { $gt: 0 },
    ...options
  });
};

// Instance method to check if user has claimed
dealSchema.methods.hasUserClaimed = function(userId) {
  return this.claimed_by.includes(userId);
};

const Deal = mongoose.model('Deal', dealSchema);

module.exports = Deal;