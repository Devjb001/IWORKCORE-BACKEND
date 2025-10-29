const express = require('express');
const authController = require('../controllers/authController');
const onboardingController = require('../controllers/onboardingController');
const { protect, requireEmailVerification } = require('../middlewares/auth');
const {
  validateSignup,
  validateSignin,
  validateForgotPassword,
  validateResetPassword,
  validate2FACode,
  validateRefreshToken,
  validateOnboardingStep,
  handleValidationErrors
} = require('../middlewares/validation');

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Authentication
router.post('/signup', validateSignup, handleValidationErrors, authController.signup);
router.post('/signin', validateSignin, handleValidationErrors, authController.signin);
router.post('/verify-2fa', validate2FACode, handleValidationErrors, authController.verify2FA);

// Password Management
router.post('/forgot-password', validateForgotPassword, handleValidationErrors, authController.forgotPassword);
router.patch('/reset-password/:token', validateResetPassword, handleValidationErrors, authController.resetPassword);

// Email Verification
router.get('/verify-email/:token', authController.verifyEmail);

// Token Management
router.post('/refresh-token', validateRefreshToken, handleValidationErrors, authController.refreshToken);

// ==================== PROTECTED ROUTES ====================

// Logout
router.post('/logout', protect, authController.logout);
router.post('/logout-all', protect, authController.logoutAll);

// Two-Factor Authentication Management
router.post('/2fa/enable', protect, authController.enable2FA);
router.post('/2fa/confirm', protect, validate2FACode, handleValidationErrors, authController.confirm2FA);
router.post('/2fa/disable', protect, validate2FACode, handleValidationErrors, authController.disable2FA);

// Onboarding (requires email verification)
router.get('/onboarding/status', protect, requireEmailVerification, onboardingController.getOnboardingStatus);
router.patch('/onboarding/step', protect, requireEmailVerification, validateOnboardingStep, handleValidationErrors, onboardingController.updateOnboardingStep);
router.post('/onboarding/complete', protect, requireEmailVerification, onboardingController.completeOnboarding);
router.post('/onboarding/reset', protect, onboardingController.resetOnboarding);

module.exports = router;