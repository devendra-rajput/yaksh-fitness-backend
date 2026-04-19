// services/appleVerify.js
const axios = require("axios");
const jwt = require("jsonwebtoken");
const i18n = require('../config/v1/i18n');

class AppleService {

  generateAppleJWT = async () => {
    console.log("AppleService@generateAppleJWT");

    const APP_STORE_KEY_ID = process.env.APP_STORE_KEY_ID;
    const APP_STORE_ISSUER_ID = process.env.APP_STORE_ISSUER_ID;
    const APP_STORE_PRIVATE_KEY = process.env.APP_STORE_PRIVATE_KEY; // This should be the full .p8 file contents (string)
    const APP_STORE_BUNDLE_ID = process.env.APP_STORE_BUNDLE_ID; // Your app's bundle identifier

    // JWT payload
    const payload = {
      iss: APP_STORE_ISSUER_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 5), // valid for 5 min
      aud: "appstoreconnect-v1",
      bid: APP_STORE_BUNDLE_ID
    };

    // Sign the JWT using ES256
    return jwt.sign(payload, APP_STORE_PRIVATE_KEY, {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: APP_STORE_KEY_ID
      }
    });
  }

  verifyAppleSubscription = async (originalTransactionId) => {
    console.log("AppleService@verifyAppleSubscription");

    try {
      const jwtToken = await this.generateAppleJWT();

      const url = `https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/${originalTransactionId}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${jwtToken}`
        }
      });

      if(!response?.data){
        return {
          status: false,
          message: i18n.__("error.serverError")
        }
      }

      return {
        status: true,
        data: response.data
      }

    } catch (error) {
      console.log("AppleService@verifyAppleSubscription Error: ", error);
      return {
        status: false,
        message: error?.message ? error.message : i18n.__("error.serverError")
      }
    }

  }
}

module.exports = new AppleService;
