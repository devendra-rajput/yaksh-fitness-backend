/**
 * Swagger API Documentation Configuration
 * Defines OpenAPI 3.0 specification for the API
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Node.js Production-Ready API',
      version: '1.0.0',
      description: `
A high-performance, enterprise-grade API with user management, authentication, and file handling.

## 🚀 Architecture Features

| Feature | Implementation | Details |
|---------|---------------|---------|
| **Scalability** | PM2 Cluster Mode | Utilizes all CPU cores (4 instances) |
| **Performance** | Redis Caching | 1-hour TTL for frequently accessed data |
| **Rate Limiting** | Redis-based | 200 requests/second per IP |
| **Timezone Support** | Dynamic Handling | Send \`x-timezone\` header (e.g., \`America/New_York\`) |
| **Documentation** | OpenAPI 3.0 | Interactive Swagger UI |
| **Logging** | Winston | Structured JSON logs |
| **Security** | Helmet + CORS | Secure HTTP headers |

## 📝 Timezone Usage

All dates are stored in **UTC** and returned in **ISO 8601** format. To receive dates in your timezone:

\`\`\`http
GET /api/v1/users/1
x-timezone: America/New_York
\`\`\`

## 🔒 Rate Limiting

- **Limit**: 200 requests per second per IP
- **Response**: \`429 Too Many Requests\` when exceeded
- **Storage**: Distributed across Redis for cluster support

## 🎯 Performance

- **Throughput**: 300+ req/sec tested
- **Response Time**: ~150ms average
- **Caching**: Automatic for user queries
      `,
      contact: {
        name: 'API Support',
        email: 'developer@devrajput.in',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Auto-detected server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      parameters: {
        timezoneHeader: {
          name: 'x-timezone',
          in: 'header',
          description: 'Timezone for date formatting (e.g., America/New_York, Europe/London, Asia/Tokyo)',
          required: false,
          schema: {
            type: 'string',
            default: 'UTC',
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./resources/v1/**/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = specs;
