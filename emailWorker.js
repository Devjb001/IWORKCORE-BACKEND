const { Worker } = require('bullmq');
const { sendEmail } = require('./src/utils/email');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL

const connection = {
  url: process.env.REDIS_URL || redisUrl,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};


// Create worker to process email jobs
const emailWorker = new Worker(
  'email',
  async (job) => {
    console.log(`Processing email job ${job.id} for ${job.data.to}`);
    
    try {
      await sendEmail(job.data);
      console.log(`✓ Email job ${job.id} completed`);
      return { success: true };
    } catch (error) {
      console.error(`✗ Email job ${job.id} failed:`, error.message);
      throw error; 
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10, 
      duration: 1000 
    }
  }
);

// Event listeners
emailWorker.on('completed', (job) => {
  console.log(`✓ Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`✗ Job ${job.id} failed:`, err.message);
});

emailWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Email worker started and listening for jobs...');

module.exports = emailWorker;