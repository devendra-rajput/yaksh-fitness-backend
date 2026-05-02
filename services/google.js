/**
 * Google OAuth Service
 *
 * Verifies Google ID tokens server-side using google-auth-library.
 * Never trust tokens from the client – always verify with Google's servers.
 *
 * Usage:
 *   const googleService = require('./google');
 *   const payload = await googleService.verifyIdToken(idToken);
 */

const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!CLIENT_ID) {
  console.warn('⚠️  GOOGLE_CLIENT_ID is not set – Google login will be unavailable');
}

/**
 * Lazily created OAuth2Client (avoids loading on startup if Google is disabled)
 */
let client = null;

const getClient = () => {
  if (!client) {
    client = new OAuth2Client(CLIENT_ID);
  }
  return client;
};

/**
 * Verify a Google ID token and return the payload.
 *
 * @param {string} idToken - The ID token sent from the frontend
 * @returns {Promise<{ googleId: string, email: string, name: string, picture: string } | false>}
 */
const verifyIdToken = async (idToken) => {
  try {
    const ticket = await getClient().verifyIdToken({
      idToken,
      audience: CLIENT_ID, // Ensures token was issued for THIS app
    });

    const payload = ticket.getPayload();
    if (!payload) return false;

    return {
      googleId: payload.sub, // Stable Google user ID
      email: payload.email,
      emailVerified: payload.email_verified,
      firstName: payload.given_name || '',
      lastName: payload.family_name || '',
      picture: payload.picture || '',
    };
  } catch (error) {
    console.error('GoogleService@verifyIdToken Error:', error.message);
    return false;
  }
};

/**
 * Verify a Google access_token by calling Google's userinfo endpoint and return
 * the same payload shape as verifyIdToken so callers are interchangeable.
 *
 * @param {string} accessToken - The OAuth2 access token from the frontend
 */
const getUserInfo = async (accessToken) => {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.sub) return false;
    return {
      googleId: data.sub,
      email: data.email || null,
      emailVerified: !!data.email_verified,
      firstName: data.given_name || '',
      lastName: data.family_name || '',
      picture: data.picture || '',
    };
  } catch (error) {
    console.error('GoogleService@getUserInfo Error:', error.message);
    return false;
  }
};

module.exports = { verifyIdToken, getUserInfo };
