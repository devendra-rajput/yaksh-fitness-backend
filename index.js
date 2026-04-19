const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { startCronJob } = require('./utils/cron.utils');
// const { initSocket } = require('./services/socket');

const app = express();
let server;

// Initial setup
require('./startup')(app);
require('./config/v1/mongodb');

app.enable('trust proxy');

// Server configuration
const port = process.env.APPLICATION_PORT || 8000;

if (process.env.SSL_STATUS === 'true') {
    const key = fs.readFileSync(process.env.SSL_KEY_PEM_PATH, 'utf8');
    const cert = fs.readFileSync(process.env.SSL_CERT_PEM_PATH, 'utf8');
    const options = { key, cert };
    server = https.createServer(options, app);
} else {
    server = http.Server(app);
}

// Establish the socket.io connection
// initSocket(server); 

server.listen(port, '0.0.0.0', () => {
    console.log('listening on port:', port);

    startCronJob()

});

server.timeout = 300000; // 5 minutes
