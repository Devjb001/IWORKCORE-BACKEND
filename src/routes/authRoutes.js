const express = require('express');
const router = express.Router();

// === CONTROLLERS ===
const { signin } = require('../controllers/authControllers/signin');
const { signup } = require('../controllers/authControllers/signup');
const { refreshToken, logout, logoutAll } = require('../controllers/authControllers/signout_refreshToken');
const { forgotPassword, resetPassword } = require('../controllers/authControllers/forgotPassword');
const { sendVerificationEmail, verifyEmail, resendVerificationEmail } = require('../controllers/authControllers/verifyMail');
const { enable2FA, confirm2FA, disable2FA } = require('../controllers/authControllers/twoFactorAuth');
const { deleteAccount } = require('../controllers/authControllers/deleteAccount');


// === AUTH MIDDLEWARE ===
const { 
  protect, 
} = require('../middlewares/auth');

// === VALIDATION MIDDLEWARE ===
const {
  handleValidationErrors,
  validateSignup,
  validateSignin,
  validateForgotPassword,
  validateResetPassword,
  validate2FACode,
  validateRefreshToken,
} = require('../middlewares/validation');




// === ROUTES ===
router.post('/auth/signup', validateSignup, handleValidationErrors, signup);
router.post('/auth/signin', validateSignin, handleValidationErrors, signin);
router.delete("/auth/delete-account", protect, deleteAccount);

// Email Verification
router.post('/auth/send-verification-email', sendVerificationEmail);
router.get('/auth/verify-email/:token', verifyEmail);
router.post('/auth/resend-verification-email', resendVerificationEmail);

// Forgot & Reset Password
router.post('/auth/forgot-password', validateForgotPassword, handleValidationErrors, forgotPassword);
router.post('/auth/reset-password/:token', validateResetPassword, handleValidationErrors, resetPassword);

// Token Refresh & Logout
router.post('/auth/refresh-token', validateRefreshToken, handleValidationErrors, refreshToken);
router.post('/auth/logout', logout);
router.post('/auth/logout-all', logoutAll);

// 2FA (Two-Factor Authentication)
// router.post('/2fa/enable', protect, enable2FA);
// router.post('/2fa/confirm', protect, validate2FACode, handleValidationErrors, confirm2FA);
// router.post('/2fa/disable', protect, validate2FACode, handleValidationErrors, disable2FA);

module.exports = router;