const express = require('express');
const routes = express.Router();

/** Controllers **/ 
const favouriteController = require("../resources/v1/favourites/favourites.controller");

/** Validations **/ 
const favouriteValidation = require("../resources/v1/favourites/favourites.validation");

/** Middleware **/ 
const authMiddleware = require("../middleware/v1/authorize");

routes.post('/', [authMiddleware.auth(), favouriteValidation.createOne], favouriteController.createOne);
routes.get('/', [authMiddleware.auth(), favouriteValidation.getAllWithPagination], favouriteController.getAllWithPagination);

module.exports = routes;