const { redisClient } = require('../config/v1/redis');

class RedisService {

    setKey = async (key, data, expiration = process.env.REDIS_EXPIRATION) => {
        console.log('RedisService@setKey');

        let hasSaved = await redisClient.set(key, JSON.stringify(data), {
            'EX': expiration
        });
        if (!hasSaved) {
            return false;
        }

        return true;
    }

    getAllKeys = async () => {
        console.log('RedisService@getAllKeys');

        let keys = await redisClient.keys(`*`);
        if (keys.length < 1) {
            return false;
        }

        return keys;
    }

    getAllSpecificKeys = async (keyPrefix) => {
        console.log('RedisService@getAllSpecificKeys');

        let keys = await redisClient.keys(`${keyPrefix}*`);
        if (keys.length < 1) {
            return false;
        }

        return keys;
    }

    getKey = async (key) => {
        console.log('RedisService@getKey');

        let data = await redisClient.get(key);
        if (!data) {
            return false;
        }

        return JSON.parse(data);
    }

    getCount = async () => {
        console.log('RedisService@getCount');

        let data = await getAllKeys();
        if (!data) {
            return false;
        }

        return data.length;
    }

    clearKey = async (key) => {
        console.log('RedisService@clearKey');

        let deletedKeyCount = await redisClient.del(key);
        if (deletedKeyCount < 1) {
            return false;
        }

        return true;
    }

    flushAll = async () => {
        console.log('RedisService@flushAll');
        
        let flushAll = await redisClient.flushAll();
        if (flushAll < 1) {
            return false;
        }

        return true;
    }
}

module.exports = new RedisService;