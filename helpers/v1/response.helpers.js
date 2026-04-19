require('dotenv').config();
const i18n = require('../../config/v1/i18n');

class ResponseHelper {
    success = async (msg, res, data) => {
        this.sendResponse(200, msg, res, data);
    };

    created = async (msg, res, data) => {
        this.sendResponse(201, msg, res, data);
    };

    disallowed = async (msg, res, data) =>{
        this.sendResponse(405, msg, res, data);
    };

    noContent = async (msg, res, data) => {
        this.sendResponse(204, msg, res, data);
    };

    badRequest = async (msg, res, data) => {
        this.sendResponse(400, msg, res, data);
    };

    validationError = async (msg, res, data) => {
        this.sendResponse(422, msg, res, data);
    };

    unauthorized = async (msg, res, data) => {
        this.sendResponse(401, msg, res, data);
    };

    forbidden = async (msg, res, data) => {
        this.sendResponse(403, msg, res, data);
    };

    notFound = async (msg, res, data) => {
        this.sendResponse(404, msg, res, data);
    };

    exception = async (msg, res, data) => {
        this.sendResponse(500, msg, res, data);
    };

    conflict = async (msg, res, data) => {
        this.sendResponse(409, msg, res, data);
    };

    custom = async (code, msg, res, data) => {
        this.sendResponse(code, msg, res, data);
    }

    redirect = async (url, res) => {
        return res.status(302).send({
            api_ver: process.env.API_VER,
            redirect_to: url,
        });
    };

    twoFactorEnabled = async (res) => {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        return res.status(200).send({
            api_ver: process.env.API_VER,
            msg: 'TwoFactor authentication has been enabled for your account. We have sent you an access code to the phone associated to your account. Please verify the code to proceed',
            two_factor: true
        });
    };

    sendResponse = async (code, msg, res, data) => {
        console.log(msg, "=======msg");
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE,OPTIONS');

        const responseBody = {
            statusCode: code,
            api_ver: process.env.API_VER || 'v1',
            message: i18n.__(msg)
        };

        if (data) 
            responseBody.data = data;

        return res.status(code).send(responseBody);
    }
}



module.exports = new ResponseHelper;