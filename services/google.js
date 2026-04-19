// services/googleVerify.js
const { google } = require("googleapis");

class GoogleService {

  getGoogleAuth = async () => {
    console.log("GoogleService@getGoogleAuth");

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
      // Using key file
      return new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
        scopes: ["https://www.googleapis.com/auth/androidpublisher"]
      });
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      // Using JSON from env
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/androidpublisher"]
      });
    } else {
      throw new Error("Google service account credentials are not set.");
    }
  }

  verifyGoogleSubscription = async (packageName, subscriptionId, purchaseToken) => {
    console.log("GoogleService@verifyGoogleSubscription");

    const auth = await this.getGoogleAuth();

    const androidPublisher = google.androidpublisher({ version: "v3", auth });

    try {
      const res = await androidPublisher.purchases.subscriptions.get({ packageName, subscriptionId, token: purchaseToken });

      if(!res?.data){
        return {
          status: false,
          message: i18n.__("error.serverError")
        }
      }

      return {
        status: true,
        data: response.data
      }
      
    } catch (err) {
      console.log("GoogleService@verifyGoogleSubscription Error: ", err);
      return {
        status: false,
        message: err?.message ? err.message : i18n.__("error.serverError")
      }
    }
  }

}

module.exports = new GoogleService;
