const app = require('./app');
const http = require('http');
require('dotenv').config();

if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
  require('./emailWorker');
  console.log('Email worker enabled');
}

const server = http.createServer(app);


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

