const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password:     { type: String, required: false }, // staff invited may set later
  firstName:    { type: String },
  lastName:     { type: String },
  phone:        { type: String },
  positionTitle:{ type: String },
  profilePicture:{ type: String }, 
  role:         { type: String, enum: ['hr','staff'], required: true },
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
  onboarded:    { type: Boolean, default: false },
  status:       { type: String, enum: ['active','pending','suspended'], default: 'pending' },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  tempTwoFactorSecret: { type: String },


  // Secure token management
  passwordResetToken:   { type: String },
  passwordResetExpires: { type: Date },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  emailVerified: { type: Boolean, default: false },
  
  // Refresh Tokens
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date
  }]
}, { timestamps: true });

// Generate email verification toke

userSchema.methods.generateSecureToken = function (field, expiresInMinutes = 15) {

  const token = crypto.randomBytes(32).toString('hex');
  this[field] = bcrypt.hashSync(token, 10);
  this[`${field}Expires`] = Date.now() + expiresInMinutes * 60 * 1000;
  return token;
};

// password hash hook
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// instance method
userSchema.methods.comparePassword = async function(plain) {
  if (!this.password) return false;
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.generateJWT = function() {
  return jwt.sign({ id: this._id, role: this.role, companyId: this.companyId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

module.exports = mongoose.model('User', userSchema);
