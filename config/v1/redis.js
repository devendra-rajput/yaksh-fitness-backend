require('dotenv').config();
const redis = require('redis');

const redisUrl = `redis://${process.env.REDIS_URL}:${process.env.REDIS_PORT}`;

const redisClient = redis.createClient({
    url : redisUrl
});

// Connect Redis server
redisClient.connect();

redisClient.on("ready", () => {
    console.log('Redis have ready!')
})

redisClient.on('connect', async() => {
    console.log('Redis connected successfully!')
});

redisClient.on("error", async(error) => {
    console.error(`Redis Error: ${error}`)
});

module.exports = {
    redisClient
};
