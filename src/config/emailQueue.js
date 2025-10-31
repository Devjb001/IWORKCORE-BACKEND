const { Queue } = require('bullmq');

// Redis URL
const redisUrl = process.env.REDIS_URL

const connection = {
  url: process.env.REDIS_URL || redisUrl,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

const emailQueue = new Queue('email', { connection });

module.exports = emailQueue;