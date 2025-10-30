const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyName: { type: String, required: true, index: true },
  companyEmail: { type: String, required: true, lowercase: true, trim: true },
  industry: { type: String },
  website: { type: String },
  address: { type: String },
  city: { type: String },
  country: { type: String },
  employeeCount: { type: Number },
  logo: { type: String },
  description: { type: String },
  missionStatement: { type: String },
  values: { type: String },
  hrId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // etup Preferences (from onboarding screen)
  setupPreferences: {
    type: [String],
    enum: [
      "onboarding_hires",
      "team_performance",
      "managing_operations",
      "team_management",
      "setting_up_payroll",
      "decide_later"
    ],
    default: []
  },

  // Track onboarding progress
  onboardingCompleted: { type: Boolean, default: false },
  onboardingStep: { type: Number, default: 0 },

}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
