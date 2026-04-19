const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const privateKey = fs.readFileSync('./key.p8', 'utf8');
const { faker } = require('@faker-js/faker');

class SocialLoginService {

  constructor() {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    this.randomFirstname = faker.person.firstName();
    this.randomLastName = faker.person.lastName();

    this.randomEmail = faker.internet.email({
      firstName: this.randomFirstname,
      lastName: this.randomLastName
    });

    this.appleConfig = {
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: privateKey
    };
  }

  async generateRandomEmail() {
    return this.randomEmail;
  }

  async generateRandomFirstName() {
    return this.randomFirstname;
  }

  async generateRandomLastName() {
    return this.randomLastName;
  }

  /**
   * Main social login function
   * @param {string} provider - 'google' or 'apple'
   * @param {string} token - ID token from the provider
   * @param {Object} additionalData - Any additional data (e.g., Apple authorization code)
   * @returns {Object} User data
   */
  async validateToken(provider, token, additionalData = {}) {
    try {
      let userData;

      switch (provider.toLowerCase()) {
        case 'google':
          userData = await this.handleGoogleLogin(token, additionalData);
          break;
        case 'apple':
          userData = await this.handleAppleLogin(token, additionalData);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      return userData;

    } catch (error) {
      throw new Error(`${provider} authentication failed: ${error.message}`);
    }
  }

  /**
   * Handle Google OAuth login
   * @param {string} idToken - Google ID token
   * @returns {Object} User data
   */
  async handleGoogleLogin(idToken, additionalData = {}) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return {
          status_code: "expire_token",
          message: "Google token has expired"
        }
      }

      return {
        status_code: "success",
        social_id: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name,
        first_name: payload.given_name,
        last_name: payload.family_name,
        picture: payload.picture,
        provider: 'google'
      };

    } catch (error) {
      if (error.message.includes('Token used too early')) {
        return {
          status_code: "used_before_time",
          message: "Google token used before valid time"
        }
      }
      if (error.message.includes('Invalid token signature')) {
        return {
          status_code: "invalid_sign",
          message: "Invalid Google token signature"
        }
      }
      if (error.message.includes('Token used too late')) {
        return {
          status_code: "invalid_after_time",
          message: "Token used too late"
        }
      }
      return {
        status_code: "invalid",
        message: error.message
      }
    }
  }

  /**
   * Handle Apple Sign In
   * @param {string} identityToken - Apple identity token
   * @param {Object} additionalData - Authorization code, user info, etc.
   * @returns {Object} User data
   */
  async handleAppleLogin(identityToken, additionalData = {}) {
    try {
      const { status_code, decoded, message } = await this.verifyAppleToken(identityToken);

      if (status_code == "invalid") {
        return {
          status_code: status_code,
          message: message
        }
      }

      let userData = {
        social_id: decoded.sub,
        email: decoded.email ?? await this.generateRandomEmail(),
        email_verified: decoded.email_verified === 'true',
        provider: 'apple'
      };

      // Apple only provides name and email on first sign-in
      if (additionalData.user) {
        const userInfo = typeof additionalData.user === 'string'
                          ? JSON.parse(additionalData.user)
                          : additionalData.user;

        userData.name = userInfo.name ? `${userInfo.name.firstName || ''} ${userInfo.name.lastName || ''}`.trim() : null;
        userData.first_name = userInfo.name?.firstName || null;
        userData.last_name = userInfo.name?.lastName || null;
      }

      if (userData.email && userData.email.includes('@privaterelay.appleid.com')) {
        userData.is_private_email = true;
      }

      return {
        status_code: "success",
        ...userData
      };

    } catch (error) {
      return {
        status_code: "invalid",
        message: error.message
      }
    }
  }

  /**
   * Verify Apple identity token
   */
  async verifyAppleToken(identityToken) {
    try {
      const appleKeys = await this.getApplePublicKeys();

      const header = jwt.decode(identityToken, { complete: true }).header;
      const key = appleKeys.find(k => k.kid === header.kid);

      if (!key) {
        return {
          status_code: "invalid",
          message: "Apple public key not found"
        }
      }

      const publicKey = this.createPublicKey(key);
      const decoded = jwt.verify(identityToken, publicKey, {
        algorithms: ['RS256'],
        audience: this.appleConfig.clientId,
        issuer: 'https://appleid.apple.com'
      });

      return {
        status_code: "success",
        decoded: decoded
      }

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          status_code: "invalid",
          message: "Apple token has expired"
        }
      }
      if (error.name === 'JsonWebTokenError') {
        return {
          status_code: "invalid",
          message: "Invalid Apple token"
        }
      }
      return {
        status_code: "invalid",
        message: error.message
      }
    }
  }

  /**
   * Get Apple's public keys
   */
  async getApplePublicKeys() {
    try {
      const response = await axios.get('https://appleid.apple.com/auth/keys', {
        timeout: 10000
      });
      return response.data.keys;
    } catch (error) {
      throw new Error('Failed to fetch Apple public keys');
    }
  }

  /**
   * Create public key from Apple's JWK
   */
  createPublicKey(key) {
    const { n, e } = key;
    // const nBuffer = Buffer.from(n, 'base64url');
    // const eBuffer = Buffer.from(e, 'base64url');

    const publicKey = crypto.createPublicKey({
      key: {
        kty: 'RSA',
        n: n,
        e: e
      },
      format: 'jwk'
    });

    return publicKey.export({ format: 'pem', type: 'spki' });
  }
}

module.exports = new SocialLoginService();