const express = require('express');
const routes = express.Router();

/** Controllers **/
const scanController = require("../resources/v1/scans/scans.controller");

/** Validations **/
const scanValidation = require("../resources/v1/scans/scans.validation");

/** Middleware **/
const authMiddleware = require("../middleware/v1/authorize");

/** Utility file */
const uploadUtils = require("../utils/upload");
const aws = require("../services/aws");

const uploadDirectory = "uploads/scan";
const validFileExtenstions = /jpg|jpeg|png|heic/;
const maxFileSize = 15 * 1024 * 1024 // 15 MB

routes.post('/body', [
    authMiddleware.auth(),
    uploadUtils.uploadFile(validFileExtenstions, maxFileSize, uploadDirectory).single('image')
], scanController.scanBody);

// routes.post('/food', [
//     authMiddleware.auth(),
//     uploadUtils.uploadFile(validFileExtenstions, maxFileSize, uploadDirectory).single('image')
// ], scanController.scanFood);

routes.post('/food/log', [authMiddleware.auth(), scanValidation.scanFoodLog], scanController.scanFoodLog);

routes.post('/menu', [
    authMiddleware.auth(),
    uploadUtils.uploadFile(validFileExtenstions, maxFileSize, uploadDirectory).single('image')
], scanController.scanMenu);

routes.get('/body-stats', [authMiddleware.auth()], scanController.getBodyStats);
routes.get('/', [authMiddleware.auth()], scanController.getAllWithPagination);
routes.post('/model-webhook', scanController.modelWebhook);

routes.post(
    '/upload-image',
    [
        authMiddleware.auth(),
        uploadUtils.uploadFile(validFileExtenstions, maxFileSize, uploadDirectory).single('image'),
        aws.uploadFile
    ],
    scanController.uploadImageAWS
);
routes.delete('/history', [authMiddleware.auth(), scanValidation.deleteHistory], scanController.deleteHistory);
routes.get('/result/:id', [authMiddleware.auth()], scanController.getScanResult);

module.exports = routes;