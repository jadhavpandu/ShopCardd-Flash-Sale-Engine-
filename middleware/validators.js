
// middleware/validators.js - Input Validation Rules
const { body, param, query, validationResult } = require('express-validator');

// creating the Deal Validators
const createDealValidators = [
  body('merchant_id')
    .notEmpty().withMessage('Merchant ID is required')
    .isString().withMessage('Merchant ID must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Merchant ID too long'),
  
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .trim()
    .isLength({ min: 5, max: 200 }).withMessage('Title must be between 5-200 characters'),
  
  body('total_vouchers')
    .notEmpty().withMessage('Total vouchers is required')
    .isInt({ min: 1, max: 10000 }).withMessage('Total vouchers must be between 1-10000'),
  
  body('valid_until')
    .notEmpty().withMessage('Expiration date is required')
    .isISO8601().withMessage('Invalid date format (use ISO 8601)')
    .custom((value) => {
      const expiryDate = new Date(value);
      if (expiryDate <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
      return true;
    }),
  
  body('location.lat')
    .notEmpty().withMessage('Latitude is required')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  
  body('location.lng')
    .notEmpty().withMessage('Longitude is required')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  
  handleValidationErrors
];