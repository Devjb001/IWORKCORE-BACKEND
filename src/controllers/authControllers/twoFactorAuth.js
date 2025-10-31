const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../../models/User');

exports.enable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Generate secret for this user
    const secret = speakeasy.generateSecret({
      name: `iWorkCore (${user.email})`,
      length: 20,
    });

    // Save temp secret until confirmed
    user.tempTwoFactorSecret = secret.base32;
    await user.save();

    // Generate QR code (for Google Authenticator)
    const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);

    res.status(200).json({
      status: 'success',
      message: 'Scan the QR code to set up Two-Factor Authentication',
      data: {
        qrCode: qrCodeDataURL,
        manualCode: secret.base32,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

exports.confirm2FA = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user._id);

    if (!user || !user.tempTwoFactorSecret) {
      return res.status(400).json({
        status: 'error',
        message: 'No Two-Factor setup in progress',
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.tempTwoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired Two-Factor Authentication code',
      });
    }

    // Move tempSecret to permanent and enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorSecret = user.tempTwoFactorSecret;
    user.tempTwoFactorSecret = undefined;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Two-Factor Authentication enabled successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

exports.disable2FA = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user._id);

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({
        status: 'error',
        message: 'Two-Factor Authentication is not currently enabled',
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid Two-Factor Authentication code',
      });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Two-Factor Authentication disabled successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
