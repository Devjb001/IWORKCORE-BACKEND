const { Worker } = require('bullmq');
const { sendEmail } = require('./src/utils/email');

const connection =({
  username: 'default',
  password: process.env.REDIS_PASSWORD,
  host: 'redis-10002.c62.us-east-1-4.ec2.redns.redis-cloud.com',
  port: 10002,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const emailWorker = new Worker(
  'email',
  async (job) => {
    console.log(`Processing email job ${job.id} for ${job.data.to}`);
    
    try {
      await sendEmail(job.data);
      console.log(`Email job ${job.id} completed`);
      return { success: true };
    } catch (error) {
      console.error(`Email job ${job.id} failed:`, error.message);
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

emailWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

emailWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Email worker started and listening for jobs...');

module.exports = emailWorker;