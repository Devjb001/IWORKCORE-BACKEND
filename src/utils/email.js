const nodemailer = require('nodemailer');
require('dotenv').config()
// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Email templates
const templates = {
  emailVerification: (data) => ({
    subject: 'Verify Your Email - iWorkCore HR',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to TeamFlow HR!</h1>
            </div>
            <div class="content">
              <h2>Hi ${data.name},</h2>
              <p>Thank you for signing up! Please verify your email address to get started.</p>
              <p>Click the button below to verify your email:</p>
              <a href="${data.verificationUrl}" class="button">Verify Email</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${data.verificationUrl}</p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create an account, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} iWorkCore HR. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${data.name},
      
      Thank you for signing up! Please verify your email address by clicking the link below:
      
      ${data.verificationUrl}
      
      This link will expire in 24 hours.
      
      If you didn't create an account, please ignore this email.
      
      © ${new Date().getFullYear()} iWorkCore HR. All rights reserved.
    `
  }),

  passwordReset: (data) => ({
    subject: 'Password Reset Request - iWorkCore HR',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hi ${data.name},</h2>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <a href="${data.resetUrl}" class="button">Reset Password</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${data.resetUrl}</p>
              <div class="warning">
                <strong>Important:</strong> This link will expire in 10 minutes for security reasons.
              </div>
              <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} TeamFlow HR. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${data.name},
      
      We received a request to reset your password. Click the link below to create a new password:
      
      ${data.resetUrl}
      
      This link will expire in 10 minutes for security reasons.
      
      If you didn't request a password reset, please ignore this email or contact support if you have concerns.
      
      © ${new Date().getFullYear()} TeamFlow HR. All rights reserved.
    `
  })
};

// Send email function
exports.sendEmail = async (options) => {
  try {
    const transporter = createTransporter();
    
    // Get template
    const template = templates[options.template](options.data);
    
    // Email options
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to: options.to,
      subject: options.subject || template.subject,
      html: template.html,
      text: template.text
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    console.log(`Email sent successfully to ${options.to}`);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error('Failed to send email');
  }
};