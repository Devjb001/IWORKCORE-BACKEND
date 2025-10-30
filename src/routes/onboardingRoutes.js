const express = require('express');
const router = express.Router();

// === CONTROLLERS ===
const {
  getOnboardingStatus,
  setSetupPreferences,
  completeOnboarding
} = require('../controllers/onboardingController');

// === MIDDLEWARES ===
const {
  protect,
  requireEmailVerification,
  restrictTo
} = require('../middlewares/auth');

const {
  handleValidationErrors,
  validateOnboardingStep
} = require('../middlewares/validation');

// === ROUTES ===

// Get current onboarding status 
router.get(
  '/status',
  protect,
  requireEmailVerification,
  restrictTo('hr'),
  getOnboardingStatus
);

// Set setup preferences
router.post(
  '/preferences',
  protect,
  requireEmailVerification,
  restrictTo('hr'),
  validateOnboardingStep,
  handleValidationErrors,
  setSetupPreferences
);

// Complete onboarding
router.post(
  '/complete',
  protect,
  requireEmailVerification,
  restrictTo('hr'),
  completeOnboarding
);

module.exports = router;
