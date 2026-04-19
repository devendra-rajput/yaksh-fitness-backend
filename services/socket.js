/**
 * Socket.IO Service
 * Handles real-time bidirectional communication
 */

const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const i18n = require('../config/i18n');
const UserModel = require('../resources/v1/users/users.model');
const socketEvents = require('../constants/socket_events');

// Socket.IO instance (module-scoped)
let io = null;

/**
 * Verify JWT token
 */
const verifyToken = (token) => new Promise((resolve, reject) => {
  jwt.verify(token, process.env.JWT_TOKEN_KEY, (err, decoded) => {
    if (err) {
      return reject(err);
    }
    resolve(decoded);
  });
});

/**
 * Extract token from socket handshake
 */
const extractToken = (socket) => {
  let token = socket.handshake.headers.authorization;

  // Check for token in auth object
  if (!token && socket?.handshake?.auth?.token) {
    token = socket.handshake.auth.token;
  }

  // Remove 'Bearer ' prefix if present
  if (token && token.startsWith('Bearer ')) {
    [, token] = token.split(' ');
  }

  return token || null;
};

/**
 * Authenticate user from token
 */
const authenticateUser = async (token) => {
  // Verify token
  const decoded = await verifyToken(token);

  // Find user by decoded user_id
  const user = await UserModel.getOneByColumnNameAndValue('_id', decoded.user_id, true);
  if (!user) {
    throw new Error(i18n.__('socket.noUserFound'));
  }

  // Verify token matches stored auth_token
  if (!user?.tokens?.auth_token || user.tokens.auth_token !== token) {
    throw new Error(i18n.__('socket.tokenMismatch'));
  }

  return user;
};

/**
 * Authentication middleware for Socket.IO
 */
const authMiddleware = () => async (socket, next) => {
  try {
    // Extract token from handshake
    const token = extractToken(socket);
    if (!token) {
      return next(new Error(i18n.__('socket.noToken')));
    }

    // Authenticate user
    const user = await authenticateUser(token);

    // Attach user to socket for future use
    // eslint-disable-next-line no-param-reassign
    socket.user = user;

    next();
  } catch (err) {
    console.log('Error in authMiddleware: ', err);
    return next(new Error(i18n.__('socket.invalidToken')));
  }
};

/**
 * Handle user disconnection
 */
const handleDisconnection = (socket) => {
  const userId = socket.user?._id;
  console.log(`User disconnected: ${userId} (Socket ID: ${socket.id})`);
};

/**
 * Handle test event
 */
const handleTestEvent = (data, callback) => {
  console.log('Test event received:', data);
  callback({ message: 'Test event received', data });
};

/**
 * Register all event handlers for a socket
 */
const registerEventHandlers = (socket) => {
  // Test event handler
  socket.on(socketEvents.ON.TEST_EVENT, (data, callback) => {
    handleTestEvent(data, callback);
  });

  // Add more event handlers here as needed
};

/**
 * Handle new socket connection
 */
const handleConnection = async (socket) => {
  const userId = socket.user?._id;
  console.log(`User connected: ${userId} (Socket ID: ${socket.id})`);

  // Join user-specific room
  if (userId) {
    socket.join(`user_${userId}`);
    console.log(`Socket ${socket.id} joined room user_${userId}`);
  }

  // Register event handlers
  registerEventHandlers(socket);

  // Handle disconnection
  socket.on('disconnect', () => handleDisconnection(socket));
};

/**
 * Create Socket.IO configuration
 */
const createSocketConfig = () => ({
  path: '/socket.io',
  cors: {
    origin: '*', // Adjust for security in production
    methods: ['GET', 'POST'],
  },
});

/**
 * Initialize Socket.IO server
 */
const initSocket = (httpServer) => {
  try {
    // Create Socket.IO server with configuration
    const config = createSocketConfig();
    io = new Server(httpServer, config);
    console.log(`Socket.IO initialized on path: ${config.path}`);

    // Apply authentication middleware
    io.use(authMiddleware());

    // Handle connections
    io.on('connection', handleConnection);

    return io;
  } catch (error) {
    console.error('Failed to initialize Socket.IO:', error);
    throw error;
  }
};

/**
 * Emit event to specific users
 */
const emitToUsers = (userIds, event, data) => {
  if (!io) {
    console.warn('Socket.IO not initialized. Cannot emit to users.');
    return;
  }

  userIds.forEach((userId) => {
    io.to(`user_${userId}`).emit(event, data);
  });

  console.log(`Emitted ${event} to ${userIds.length} user(s)`);
};

/**
 * Emit event to all connected clients
 */
const emitToAll = (event, data) => {
  if (!io) {
    console.warn('Socket.IO not initialized. Cannot emit to all.');
    return;
  }

  io.emit(event, data);
  console.log(`Emitted ${event} to all connected clients`);
};

/**
 * Get Socket.IO instance
 */
const getIO = () => io;

/**
 * Cleanup Socket.IO server
 */
const cleanup = async () => {
  console.log('SocketService@cleanup');
  try {
    if (io) {
      // Close all socket connections
      await new Promise((resolve) => {
        io.close((err) => {
          if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') {
            console.error('SocketService@cleanup Error closing connections:', err);
          }
          resolve();
        });
      });

      io = null;
      console.log('✅ Socket.IO connections closed');
      return true;
    }
    return true;
  } catch (error) {
    console.error('SocketService@cleanup Error:', error);
    return false;
  }
};

// Export all functions
module.exports = {
  initSocket,
  emitToUsers,
  emitToAll,
  getIO,
  cleanup,
};
