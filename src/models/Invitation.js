const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  email:      { type: String, required: true, lowercase: true, trim: true, index: true },
  companyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  invitedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tokenHash:  { type: String, required: true },
  expiresAt:  { type: Date, required: true },
  status:     { type: String, enum: ['pending','accepted','revoked','expired'], default: 'pending' },
  role:       { type: String, enum: ['staff'], default: 'staff' },
}, { timestamps: true });

module.exports = mongoose.model('Invitation', invitationSchema);
