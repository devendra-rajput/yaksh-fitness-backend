'use strict';
require('dotenv').config();
const jwt = require('jsonwebtoken');

/** Custom Require **/ 
const response = require('../../helpers/v1/response.helpers');
const UserModel = require('../../resources/v1/users/users.model');

class Auth {
    
    // Wrap jwt.verify into a Promise for better async/await support
    verifyToken = (token) => {
        return new Promise((resolve, reject) => {
            jwt.verify(token, process.env.JWT_TOKEN_KEY, (err, decoded) => {
                if (err) {
                    return reject(err);  // Reject with the error if verification fails
                }
                resolve(decoded);  // Resolve with decoded payload if token is valid
            });
        });
    };

    auth = (roleToValidate = null) => {

        return async (req, res, next) => {    
            console.log('AuthorizationMiddleware@auth');

            if (!req.headers['authorization']) {
                return response.unauthorized('auth.unauthorizedRequest', res, false);
            }

            let token = req.headers['authorization'];
            try {

                // Verify the token
                const decoded = await this.verifyToken(token);

                // Find user by decoded user_id
                const user = await UserModel.getOneByColumnNameAndValue('_id', decoded.user_id);
                if (!user) {
                    return response.unauthorized('error.userNotFound', res, false);
                }

                // Check if the token matches the stored auth_token for the user
                if (!user?.tokens?.auth_token || user.tokens.auth_token !== token) {
                    return response.unauthorized('auth.tokenMismatch', res, false);
                }

                // Role validation
                if (roleToValidate) {
                    if (![UserModel.roles.ADMIN, UserModel.roles.USER].includes(roleToValidate) || user.role !== roleToValidate) {
                        return response.badRequest('auth.unauthorizedRole', res, false);
                    }
                }

                // Check if the user is active
                if (user.status !== UserModel.statuses.ACTIVE) {
                    const errorMessage = res.__('auth.accountBlocked', { supportEmail: process.env.SUPPORT_MAIL });
                    return response.unauthorized(errorMessage, res, false);
                }

                // Attach the user to the request
                req.user = user;

                // Proceed to next middleware
                next();
            }
            catch (error) {
                return response.unauthorized(error.message, res, false);
            }
        }
    }
}


module.exports = new Auth;