const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('mongo-sanitize');
const xss = require('xss');
const hpp = require('hpp');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// ==================== BASIC MIDDLEWARE ====================

// Body parser 
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ==================== SECURITY MIDDLEWARE ====================

// Set security HTTP headers
app.use(helmet());

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));


// Data sanitization middleware 
app.use((req, res, next) => {

  // Sanitize against NoSQL injection
  req.body = mongoSanitize(req.body);
  req.query = mongoSanitize(req.query);
  req.params = mongoSanitize(req.params);

  // Sanitize against XSS
  const sanitizeObject = (obj) => {
    if (!obj) return;
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = xss(obj[key]);
      } else if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key]);
      }
    }
  };
  sanitizeObject(req.body);
  next();
});

// Prevent parameter pollution
app.use(hpp());

// Compression
app.use(compression());

// Rate limiting 
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== DATABASE CONNECTION ====================
const { connectToDataBase } = require('./src/config/db');
connectToDataBase();

// ==================== ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});
app.get("/", (req , res) => {
    console.log("Home route accessed")
    res.status(200).json({
      message : 'This is home route, pls select a route to perform an action'
    })
})

// Import routes 
const authRoutes = require('./src/routes/authRoutes');

// Apply rate limiter only to auth routes
app.use('/api/auth', limiter, authRoutes);

// Handle undefined routes
app.all(/.*/, (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server`
  });
});

// ==================== ERROR HANDLING ====================

// Global error handler
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      error: err,
      stack: err.stack
    });
  } else {
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    } else {
      console.error('ERROR:', err);
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong'
      });
    }
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

module.exports = app;