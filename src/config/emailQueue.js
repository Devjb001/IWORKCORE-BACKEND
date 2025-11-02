const { Queue } = require('bullmq');
require('dotenv').config()

const connection =({
  username: 'default',
  password: process.env.REDIS_PASSWORD,
  host: 'redis-10002.c62.us-east-1-4.ec2.redns.redis-cloud.com',
  port: 10002,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const emailQueue = new Queue('email', { connection });

module.exports = emailQueue;