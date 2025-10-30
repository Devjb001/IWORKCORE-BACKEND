const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { sendEmail } = require('../../utils/email');
const logger = require('../../utils/logger');


// ====================== FORGOT PASSWORD ======================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'No account found with that email address',
      });
    }

    // Generate a secure token using schema helper
    const resetToken = user.generateSecureToken('passwordResetToken', 15); 
    await user.save({ validateBeforeSave: false });

    // Construct reset link
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>You requested to reset your password. Click below to set a new password:</p>
        <a href="${resetURL}" target="_blank">Reset Password</a>
        <p>This link expires in 15 minutes.</p>
      `,
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset link sent to your email',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    logger.info('forgotPassword triggered');
    logger.warn('Something looks off');
    logger.error('Server error while processing password reset', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while processing password reset',
    });
  }
};


// ====================== RESET PASSWORD ======================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Fetch all users that have an unexpired password reset token
    const users = await User.find({
      passwordResetExpires: { $gt: Date.now() },
    });

    // Find the user whose hashed token matches
    const user = users.find(u => bcrypt.compareSync(token, u.passwordResetToken));

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token',
      });
    }

    // Update password and clear reset data
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Generate a fresh JWT for immediate login
    const newToken = user.generateJWT();

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful',
      token: newToken,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    logger.info('Reset password triggered');
    logger.warn('Something looks off');
    logger.error('Server error while processing password reset', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while resetting password',
    });
  }
};
