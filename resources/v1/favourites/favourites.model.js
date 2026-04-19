const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const moment = require('moment-timezone')

/** Custom Require **/ 
const dataHelper = require('../../../helpers/v1/data.helpers');
const Favourite = require('./favourite.schema');

class FavouriteModel {

    constructor() {
        // 
    }

    createOne = async (data) => {
        console.log('FavouriteModel@createOne');

        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            let favourite = await Favourite.create(data);
            if (!favourite) {
                return false;
            }

            return favourite;

        } catch (error) {
            console.log("Error FavouriteModel@createOne: ", error);
            return false;
        }
    }

    getOneByColumnNameAndValue = async (columnName, columnValue, filterObj = {}) => {
        console.log('FavouriteModel@getOneByColumnNameAndValue');

        try {
            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            if(filterObj?.type){
                dbQuery.type = filterObj.type;
            }

            if(filterObj?.meal_id){
                dbQuery.meal_id = filterObj.meal_id;
            }

            if(filterObj?.workout_id){
                dbQuery.workout_id = filterObj.workout_id;
            }

            let result = await Favourite.findOne(dbQuery).collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error FavouriteModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    updateOne = async (id, data) => {
        console.log('FavouriteModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let favourite = await Favourite.findByIdAndUpdate(id, data, { new: true })
            if (!favourite) {
                return false;
            }

            return favourite;

        } catch (error) {
            console.log("Error FavouriteModel@updateOne: ", error);
            return false;
        }
    }

    deleteOne = async (id) => {
        console.log("FavouriteModel@deleteOne");

        try {
            let result = await Favourite.deleteOne({ _id: id })
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error FavouriteModel@deleteOne: ", error);
            return false;
        }
    }

    getAll = async (filterObj = {}) => {
        console.log('FavouriteModel@getAll');

        try {
            let results;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            if(filterObj?.user_id){
                dbQuery = {
                    ...dbQuery,
                    user_id: new ObjectId(filterObj.user_id)
                }
            }

            if(filterObj?.need_today){
                dbQuery = {
                    ...dbQuery,
                    created_at: {
                        $gte: moment().startOf('day').toDate(),
                        $lte: moment().endOf('day').toDate()
                    }
                }
            }

            let favourites = await Favourite.aggregate([
                                                { $match: dbQuery}
                                            ])
                                            .sort({ title: 1});
            
            if (!favourites) {
                results = [];
            }
            else {
                results = favourites;
            }

            return results;

        } catch (error) {
            console.log("Error FavouriteModel@getAll: ", error);
            return [];
        }
            
    }

    getAllWithPagination = async (page, limit, filterObj = {}) => {
        console.log('FavouriteModel@getAllWithPagination');

        try {
            let resObj;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            if(filterObj?.type){
                dbQuery = {
                    ...dbQuery,
                    type: filterObj.type
                };
            }

            if(filterObj?.user_id){
                dbQuery = {
                    ...dbQuery,
                    user_id: new ObjectId(filterObj.user_id)
                };
            }

            let totalRecords = await Favourite.countDocuments(dbQuery);

            let pagination = await dataHelper.calculatePagination(totalRecords, page, limit);

            let favourites = await Favourite.aggregate([
                                            { $match: dbQuery},
                                            {
                                                $lookup : {
                                                    from : "workouts",
                                                    localField : "workout_id",
                                                    foreignField : "_id",
                                                    as: "workout_data"
                                                }
                                            },
                                            { $unwind: "$workout_data" }
                                        ])
                                        .sort({ created_at: -1})
                                        .skip(pagination.offset)
                                        .limit(pagination.limit)
            
            if (!favourites) {
                resObj = {
                    data: []
                };
            }
            else {
                resObj = {
                    data: favourites,
                    pagination: {
                        total: totalRecords,
                        current_page: pagination.currentPage,
                        total_pages: pagination.totalPages,
                        per_page: pagination.limit
                    }
                };
            }

            return resObj;

        } catch (error) {
            console.log("Error FavouriteModel@getAllWithPagination: ", error);
            return false;
        }
    }

    isExist = async (filterObj = {}) => {
        console.log('FavouriteModel@isExist');

        try {
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            if(filterObj?.type){
                dbQuery.type = filterObj.type;
            }

            if(filterObj?.user_id){
                dbQuery.user_id = new ObjectId(filterObj.user_id);
            }

            if(filterObj?.meal_id){
                dbQuery.meal_id = filterObj.meal_id;
            }

            if(filterObj?.workout_id){
                dbQuery.workout_id = filterObj.workout_id;
            }

            let count = await Favourite.countDocuments(dbQuery);
            if (!count || count <= 0) {
                return false;
            }

            return true

        } catch (error) {
            console.log("Error FavouriteModel@isExist: ", error);
            return false;
        }
    }
}

module.exports =  new FavouriteModel;
