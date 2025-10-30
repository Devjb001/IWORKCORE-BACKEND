const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { sendEmail } = require('../../utils/email');


exports.signup = async (req, res) => {
  let user;

  try {
    const { firstName, lastName, email, password, phone, inviteToken } = req.body;

    // Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists.'
      });
    }

    // If invited, validate token
    let invitedCompany = null;
    if (inviteToken) {
      const Invite = require('../../models/Invitation');
      const invite = await Invite.findOne({ token: inviteToken, email });
      if (!invite || invite.expiresAt < Date.now()) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid or expired invitation link.'
        });
      }
      invitedCompany = invite.company;
    }

    // Create user
    user = new User({
      firstName,
      lastName,
      email,
      password,
      phone,
      company: invitedCompany || null,
      role: invitedCompany ? 'staff' : 'hr',
      status: invitedCompany ? 'pending' : 'active'
    });

    // Create email verification token
    const verificationToken = user.createEmailVerificationToken();

    // Generate tokens
    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    });
    const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });

    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    //Save user
    await user.save({ validateBeforeSave: false });

    //  Mark invite as accepted if applicable
    if (inviteToken) {
      const Invite = require('../../models/Invitation');
      await Invite.findOneAndUpdate({ token: inviteToken }, { status: 'accepted' });
    }

    // Send email AFTER everything succeeds
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email - iWorkCore HR',
      template: 'emailVerification',
      data: { name: user.firstName, verificationUrl }
    });

    // Respond
    res.status(201).json({
      status: 'success',
      message: invitedCompany
        ? 'Account created successfully. Pending approval from HR.'
        : 'Account created successfully. Please verify your email.',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
          onboarded: user.onboarded,
          status: user.status
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    // rollback only if user was partially created
    if (user && user._id) {
      await User.findByIdAndDelete(user._id);
    }

    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
