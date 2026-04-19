const jwt = require('jsonwebtoken');

/** Custom Require **/ 
const redis = require('./redis');
const i18n = require('../config/v1/i18n');
const UserModel = require('../resources/v1/users/users.model');

// Wrap jwt.verify into a Promise for better async/await support
const verifyToken = (token) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.JWT_TOKEN_KEY, (err, decoded) => {
            if (err) {
                return reject(err);  // Reject with the error if verification fails
            }
            resolve(decoded);  // Resolve with decoded payload if token is valid
        });
    });
};

const success = (msg, data) => {
    return {
        api_ver: process.env.API_VER,
        status: "success",
        message: i18n.__(msg),
        data: data,
    };
}

const error = (msg) => {
    return {
        api_ver: process.env.API_VER,
        status: "error",
        message: i18n.__(msg)
    };
}

const userKeyPrefix = 'user_';

module.exports.initSocket = (httpServer) => {

    const socketConfig = {
        path: '/api/v1/connect', // Assign a specific path
        cors: {
            // origin: ['http://localhost:3000'], // Replace with the allowed origins. It Accept the array of domains
            methods: '*' // Specify the allowed HTTP methods
        }
    }
    const io = require('socket.io')(httpServer, socketConfig);

    if (!io) {
        throw new Error('Socket.io not initialized');
    } else {
        io.use( async (socket, next) => {
            const token = socket.handshake.headers['authorization'];
            if (!token) {
                return next(new Error(i18n.__("socket.noToken")));
            }

            try {
                /** Verify the token */
                const decoded = await verifyToken(token);

                /** Find user by decoded user_id */
                const user = await UserModel.getOneByColumnNameAndValue('_id', decoded.user_id);
                if (!user) {
                    return next(new Error(i18n.__("socket.noUserFound")));
                }
    
                /** Check if the token matches the stored auth_token for the user */
                if (!user?.tokens?.auth_token || user.tokens.auth_token !== token) {
                    return next(new Error(i18n.__("socket.tokenMismatch")));
                }

                /** Attach user info to socket for future use */
                socket.user = user;

                next();
            } catch (err) {
                return next(new Error(i18n.__("socket.invalidToken")));
            }
        });

        io.on('connection', async (socket) => {

            /** Store the user's socket id in to temp DB (Redis) */
            const userId = socket.user?._id;
            const userKey = userKeyPrefix + userId;
            const hasUpdated = await redis.setKey(userKey, socket.id);
            if(!hasUpdated){
                socket.emit('error', error("socket.serverError"));
            }
            else {
                socket.emit('success', success("socket.keySaved"));
            }

            socket.on('disconnect', async () => {
                /** On disconnect the socket, Delete the user's socket id from redis */
                await redis.clearKey(userKey, socket.id);
            });

            /** Listen/Emit test event */
            socket.on('test', async (data, callback) => {
                io.to(socket.id).emit('test', success("socket.testEvent", data));
            });
        });
    }
}