const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config()

// Protect routes - require authentication
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'You are not logged in. Please log in to access this resource.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    // Check if user is active
    // if (!user.isActive) {
    //   return res.status(403).json({
    //     status: 'error',
    //     message: 'Your account has been deactivated.'
    //   });
    // }

    // Grant access
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token. Please log in again.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Your token has expired. Please log in again.'
      });
    }
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Require email verification
exports.requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      status: 'error',
      message: 'Please verify your email to access this resource.'
    });
  }
  next();
};

// Require onboarding completion
exports.requireOnboarding = (req, res, next) => {
  if (!req.user.onboardingCompleted) {
    return res.status(403).json({
      status: 'error',
      message: 'Please complete onboarding to access this resource.'
    });
  }
  next();
};

// Restrict to specific roles (for future use)
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

