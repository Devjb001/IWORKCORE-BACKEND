const User = require('../../models/User');



exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    //Get user with password
    const user = await User.findById(userId).select('+password +refreshTokens');
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    //Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        message: 'Incorrect password',
      });
    }

    //Invalidate all refresh tokens
    user.refreshTokens = [];
    await user.save({ validateBeforeSave: false });

    //Delete user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      status: 'success',
      message: 'Your account has been permanently deleted.',
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong while deleting your account.',
    });
  }
};
