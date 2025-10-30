const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User'); 
const logger = require('../utils/logger');


const ALLOWED_PREFERENCES = [
  "onboarding_hires",
  "team_performance",
  "managing_operations",
  "team_management",
  "setting_up_payroll",
  "decide_later"
];



exports.getOnboardingStatus = async (req, res) => {
  try {
    const hr = req.user;
    if (!hr.companyId) {
      return res.status(400).json({ status: 'error', message: 'No company associated with this HR account' });
    }

    const company = await Company.findById(hr.companyId).lean();
    if (!company) return res.status(404).json({ status: 'error', message: 'Company not found' });

    return res.status(200).json({
      status: 'success',
      data: {
        companyId: company._id,
        companyName: company.companyName,
        onboardingCompleted: !!company.onboardingCompleted,
        onboardingStep: company.onboardingStep || 0,
        setupPreferences: company.setupPreferences || []
      }
    });
  } catch (err) {
    logger.error('getOnboardingStatus error', err);
    return res.status(500).json({ status: 'error', message: 'Server error while fetching onboarding status' });
  }
};


exports.setSetupPreferences = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const hr = req.user;
    const { setupPreferences } = req.body;

    if (!hr.companyId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: 'error', message: 'Complete company creation first' });
    }

    if (!Array.isArray(setupPreferences)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: 'error', message: 'setupPreferences must be an array' });
    }

    // validate values & dedupe
    const deduped = Array.from(new Set(setupPreferences));
    const invalid = deduped.filter(p => !ALLOWED_PREFERENCES.includes(p));
    if (invalid.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ status: 'error', message: 'Invalid setupPreferences values', invalid });
    }

    const company = await Company.findById(hr.companyId).session(session);
    if (!company) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ status: 'error', message: 'Company not found' });
    }

    // Ensure HR is the company HR 
    if (company.hrId && company.hrId.toString() !== hr._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ status: 'error', message: 'You are not allowed to update this company' });
    }

    company.setupPreferences = deduped;
    company.onboardingStep = Math.max(company.onboardingStep || 0, 1);
    await company.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      status: 'success',
      message: 'Preferences saved',
      data: {
        companyId: company._id,
        setupPreferences: company.setupPreferences,
        onboardingStep: company.onboardingStep
      }
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('setSetupPreferences error', err);
    return res.status(500).json({ status: 'error', message: 'Server error while saving preferences' });
  }
};

exports.completeOnboarding = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const hr = req.user;
    const {
      companyName,
      companyEmail,
      industry,
      website,
      address,
      city,
      country,
      employeeCount,
      logo,
      description,
      missionStatement,
      values,
      setupPreferences = []
    } = req.body;

    if (!companyName || !companyEmail) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        status: 'error',
        message: 'companyName and companyEmail are required'
      });
    }

    let company;

    // If HR already has a company, use it; otherwise, create a new one
    if (hr.companyId) {
      company = await Company.findById(hr.companyId).session(session);
      if (!company) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ status: 'error', message: 'Company not found' });
      }
    } else {
      // Create new company
      company = await Company.create([{
        companyName,
        companyEmail,
        industry,
        website,
        address,
        city,
        country,
        employeeCount,
        logo,
        description,
        missionStatement,
        values,
        hrId: hr._id,
        setupPreferences,
        onboardingStep: 1,
        onboardingCompleted: false
      }], { session });

      //  returns an array with create([doc])
      company = company[0];

      // Link company to HR
      hr.companyId = company._id;
    }

    // Update company setupPreferences if provided
    if (Array.isArray(setupPreferences) && setupPreferences.length) {
      const deduped = Array.from(new Set(setupPreferences));
      const invalid = deduped.filter(p => !ALLOWED_PREFERENCES.includes(p));
      if (invalid.length) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: 'error',
          message: 'Invalid setupPreferences values',
          invalid
        });
      }
      company.setupPreferences = deduped;
      company.onboardingStep = Math.max(company.onboardingStep || 0, 2);
    }

    // Mark company onboarding complete
    company.onboardingCompleted = true;
    await company.save({ session });

    // Update HR user
    hr.onboarded = true;
    hr.status = 'active';
    await hr.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      status: 'success',
      message: 'Onboarding completed. You can now launch your dashboard.',
      data: {
        company: {
          id: company._id,
          companyName: company.companyName,
          onboardingCompleted: company.onboardingCompleted,
          onboardingStep: company.onboardingStep,
          setupPreferences: company.setupPreferences
        },
        user: {
          id: hr._id,
          onboarded: hr.onboarded,
          status: hr.status
        }
      }
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('completeOnboarding error', err);
    return res.status(500).json({ status: 'error', message: 'Server error while completing onboarding' });
  }
};
