/** Custom Require **/ 
const dataHelper = require('../../../helpers/v1/data.helpers');
const response = require('../../../helpers/v1/response.helpers');
const FavouriteModel = require('./favourites.model');

class FavouriteController {

    createOne = async (req, res) => {
        console.log('FavouriteController@createOne');
        
        const {
            type, 
            meal_id,
            workout_id
        } = req.body;

        let filterObj = {
            type: type
        }

        if(meal_id){
            filterObj.meal_id = meal_id;
        }

        if(workout_id){
            filterObj.workout_id = workout_id;
        }

        const existedFavouriteObj = await FavouriteModel.getOneByColumnNameAndValue("user_id", req.user._id, filterObj)
        if(existedFavouriteObj?._id){
            const hasDeleted = await FavouriteModel.deleteOne(existedFavouriteObj._id);
            if(!hasDeleted){
                return response.exception("error.serverError", res, false);
            }
            return response.success("success.removedFromFavourite", res, true);
        }

        const favouriteData = {
            user_id: req.user._id,
            type: type,
            meal_id: meal_id,
            workout_id: workout_id
        }

        const favouriteObj = await FavouriteModel.createOne(favouriteData);
        if(!favouriteObj){
            return response.exception("error.serverError", res, false);
        }

        return response.success("success.markedAsFavourite", res, favouriteObj);
    }

    getAllWithPagination = async (req, res) => {
        console.log('FavouriteController@getAllWithPagination');

        /** Extract the page and limt from query param */
        const  { page, limit } = await dataHelper.getPageAndLimit(req.query);

        const { type } = req.query;

        let filterObj = {
            type: type,
            user_id: req.user._id
        };

        const result = await FavouriteModel.getAllWithPagination(page, limit, filterObj);
        if(!result?.data?.length){
            return response.success("success.noRecordsFound", res, result);
        }

        return response.success("success.favouritesData", res, result);

    }
}

module.exports = new FavouriteController;
