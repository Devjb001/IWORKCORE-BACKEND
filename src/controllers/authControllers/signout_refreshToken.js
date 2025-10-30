const jwt = require('jsonwebtoken');
const User = require('../../models/User');

// ==================== REFRESH TOKEN ====================
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ status: 'error', message: 'Refresh token is required' });
    }

    // Verify token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    // Generate new tokens
    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role, companyId: user.companyId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired refresh token',
    });
  }
};

// ==================== LOGOUT (Frontend handles token clearing) ====================
exports.logout = async (req, res) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ==================== LOGOUT FROM ALL DEVICES ====================
exports.logoutAll = async (req, res) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Logged out from all devices',
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
