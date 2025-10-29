const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/userModel');
const { sendEmail } = require('../utils/email');

// Generate JWT tokens
const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
};

// Sign Up
exports.signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

   
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }


    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone
    });

    // Generate email verification token
    const verificationToken = user.emailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email - iWorkCore HR',
      template: 'emailVerification',
      data: {
        name: user.firstName,
        verificationUrl
      }
    });

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully. Please verify your email.',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          onboardingCompleted: user.onboardingCompleted
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Sign In
exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        status: 'error',
        message: 'Account is temporarily locked due to too many failed login attempts'
      });
    }

    // Verify password
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      await user.incrementLoginAttempts();
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        status: 'error',
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Reset login attempts
    if (user.loginAttempts > 0) {
      await user.loginAttempts();
    }

    // If 2FA is enabled, send temp token instead
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { userId: user._id, type: '2fa' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      return res.status(200).json({
        status: 'success',
        message: '2FA verification required',
        data: {
          requires2FA: true,
          tempToken
        }
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Clean expired tokens and store new refresh token
    user.cleanExpiredTokens();
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          avatar: user.avatar,
          department: user.department,
          position: user.position,
          isEmailVerified: user.isEmailVerified,
          onboardingCompleted: user.onboardingCompleted,
          twoFactorEnabled: user.twoFactorEnabled
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Verify 2FA
exports.verify2FA = async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    // Verify temp token
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    
    if (decoded.type !== '2fa') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid token'
      });
    }

    // Find user with 2FA secret
    const user = await User.findById(decoded.userId).select('+twoFactorSecret +twoFactorBackupCodes');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify code
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    // Check backup codes if TOTP fails
    let usedBackupCode = false;
    if (!isValid && user.twoFactorBackupCodes.includes(code)) {
      user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(c => c !== code);
      usedBackupCode = true;
      await user.save({ validateBeforeSave: false });
    }

    if (!isValid && !usedBackupCode) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid verification code'
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token
    user.cleanExpiredTokens();
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: '2FA verification successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          avatar: user.avatar,
          isEmailVerified: user.isEmailVerified,
          onboardingCompleted: user.onboardingCompleted
        },
        accessToken,
        refreshToken,
        usedBackupCode
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Enable 2FA
exports.enable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `TeamFlow HR (${user.email})`,
      length: 20
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Store temporarily (will be confirmed in next step)
    user.twoFactorSecret = secret.base32;
    user.twoFactorBackupCodes = backupCodes;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: '2FA setup initiated',
      data: {
        secret: secret.base32,
        qrCode,
        backupCodes
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Confirm 2FA
exports.confirm2FA = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user._id).select('+twoFactorSecret');

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!isValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid verification code'
      });
    }

    user.twoFactorEnabled = true;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: '2FA enabled successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Disable 2FA
exports.disable2FA = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user._id).select('+twoFactorSecret');

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        status: 'error',
        message: '2FA is not enabled'
      });
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!isValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid verification code'
      });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = [];
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: '2FA disabled successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'No user found with that email address'
      });
    }

    // Generate reset token
    const resetToken = user.passwordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request - TeamFlow HR',
      template: 'passwordReset',
      data: {
        name: user.firstName,
        resetUrl
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset link sent to your email'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Passwords do not match'
      });
    }

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // Invalidate all refresh tokens
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Verify Email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid verification token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired verification token'
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Find user and check if refresh token exists
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken);
    
    if (!tokenExists) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // Remove old refresh token and add new one
    user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
    user.refreshTokens.push({
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired refresh token'
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const user = await User.findById(req.user._id);

    if (refreshToken) {
      user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
      await user.save({ validateBeforeSave: false });
    }

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Logout All Devices
exports.logoutAll = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.refreshTokens = [];
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Logged out from all devices'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};