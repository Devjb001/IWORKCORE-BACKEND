const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
require('dotenv').config();

/**
 * Handles HR and staff authentication
 */
exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🔹 Check for user
    const user = await User.findOne({ email }).select('+password +twoFactorSecret');
    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // 🔹 Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({
        status: 'error',
        message: 'Your account has been suspended. Contact HR admin.'
      });
    }

    // Check if email verified
    // if (!user.emailVerified) {
    //   return res.status(403).json({
    //     status: 'error',
    //     message: 'Please verify your email before signing in.'
    //   });
    // }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // If user has 2FA enabled, generate temporary token
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { userId: user._id, type: '2fa' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      return res.status(200).json({
        status: '2fa_required',
        message: '2FA verification required.',
        tempToken
      });
    }

    // Generate access and refresh tokens
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // Save refresh token
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await user.save({ validateBeforeSave: false });

    // Build safe user object
    const safeUser = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      onboarded: user.onboarded,
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled
    };

    // Success response
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: safeUser,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Signin Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during signin',
      error: error.message
    });
  }
};
