const User = require('../models/userModel');

// Get Onboarding Status
exports.getOnboardingStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      status: 'success',
      data: {
        onboardingCompleted: user.onboardingCompleted,
        currentStep: user.onboardingStep,
        onboardingData: Object.fromEntries(user.onboardingData)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Update Onboarding Step
exports.updateOnboardingStep = async (req, res) => {
  try {
    const { step, data } = req.body;
    const user = await User.findById(req.user._id);

    // Validate step progression
    if (step > user.onboardingStep + 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot skip onboarding steps'
      });
    }

    // Update step data
    if (data) {
      Object.keys(data).forEach(key => {
        user.onboardingData.set(`step${step}_${key}`, data[key]);
      });
    }

    // Update current step
    if (step > user.onboardingStep) {
      user.onboardingStep = step;
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Onboarding step updated',
      data: {
        currentStep: user.onboardingStep,
        onboardingData: Object.fromEntries(user.onboardingData)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Complete Onboarding
exports.completeOnboarding = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Optionally validate minimum steps completed
    const minSteps = 8; // Based on your Figma screens (Onboarding 1-8)
    if (user.onboardingStep < minSteps) {
      return res.status(400).json({
        status: 'error',
        message: `Please complete at least ${minSteps} onboarding steps`
      });
    }

    user.onboardingCompleted = true;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Onboarding completed successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          onboardingCompleted: user.onboardingCompleted
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Reset Onboarding (for testing or re-onboarding)
exports.resetOnboarding = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    user.onboardingCompleted = false;
    user.onboardingStep = 0;
    user.onboardingData.clear();
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Onboarding reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
