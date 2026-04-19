/**
 * @swagger
 * tags:
 *   name: Socket.IO
 *   description: Real-time bidirectional event-based communication
 */

/**
 * @swagger
 * /socket.io/:
 *   get:
 *     summary: Socket.IO Handshake
 *     description: |
 *       Initiates a Socket.IO connection.
 *
 *       **Connection Methods:**
 *       1. **Standard (Recommended)**: Use a Socket.IO client.
 *       2. **Authentication**: Pass the JWT token in the `auth` object or `Authorization` header.
 *
 *       **Client Example:**
 *       ```javascript
 *       const socket = io('http://localhost:8000', {
 *         path: '/socket.io',
 *         auth: {
 *           token: 'YOUR_JWT_TOKEN'
 *         }
 *       });
 *       ```
 *
 *       **Events:**
 *
 *       **Client -> Server:**
 *       - `test`: Send test data.
 *         - Data: Any JSON object.
 *         - Callback: Returns the data sent.
 *
 *       **Server -> Client:**
 *       - `success`: Emitted on successful connection or action.
 *       - `error`: Emitted on failure (e.g., invalid token).
 *
 *     tags: [Socket.IO]
 *     parameters:
 *       - in: query
 *         name: EIO
 *         schema:
 *           type: integer
 *           default: 4
 *         description: Engine.IO version
 *       - in: query
 *         name: transport
 *         schema:
 *           type: string
 *           enum: [polling, websocket]
 *           default: polling
 *         description: Transport mechanism
 *     responses:
 *       101:
 *         description: Switching Protocols (WebSocket)
 *       200:
 *         description: Handshake successful (Polling)
 *       401:
 *         description: Unauthorized (Invalid Token)
 */
