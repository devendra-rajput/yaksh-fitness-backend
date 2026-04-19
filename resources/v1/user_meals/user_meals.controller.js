/** Custom Require **/
const response = require('../../../helpers/v1/response.helpers');
const UserMealModel = require('./user_meals.model');
const UserStreakModel = require('../user_streaks/user_streaks.model');
const ScanModel = require('../scans/scans.model');

class UserMealController {

    // Backup
    // createOne = async (req, res) => {
    //     console.log('UserMealController@createOne');

    //     const {
    //         scan_id, 
    //         food_name,
    //         calories,
    //         protien,
    //         fats,
    //         carbs,
    //         quality_rating,
    //         quality_rating_title,
    //         quantity
    //     } = req.body;

    //     if(scan_id){
    //         const scanObj = await ScanModel.getOneByColumnNameAndValue("_id", scan_id);
    //         if(!scanObj){
    //             return response.badRequest("error.invalidScanId", res, false);
    //         }
    //     }

    //     const userMealData = {
    //         user_id: req.user._id,
    //         scan_id: scan_id,
    //         food_name: food_name,
    //         calories: calories,
    //         protien: protien,
    //         fats: fats,
    //         carbs: carbs,
    //         quality_rating: quality_rating,
    //         quality_rating_title: quality_rating_title,
    //         quantity: quantity
    //     }

    //     const userMealObj = await UserMealModel.createOne(userMealData);
    //     if(!userMealObj){
    //         return response.exception("error.serverError", res, false);
    //     }

    //     return response.success("success.addedToTracker", res, userMealObj);
    // }

    // createOne = async (req, res) => {
    //     console.log('UserMealController@createOne');

    //     for (let meal of req.body.meals) {
    //         const userMealData = {
    //             user_id: req.user._id,
    //             recognised_food_name: meal.recognised_food_name,
    //             food_name: meal.food_name,
    //             food_type: meal.food_type,
    //             nutrition: meal.nutrition,
    //             score: meal.score,
    //             brand_name: meal.brand_name,
    //             tags: meal.tags,
    //             weight_grams: meal.weight_grams,
    //             portion_size: meal.portion_size,
    //             meal_time: meal.meal_time,
    //             consumed_qty: meal.consumed_qty
    //         }

    //         await UserMealModel.createOne(userMealData);
    //     }

    //     const timezone = req.timezone || 'UTC';
    //     await UserStreakModel.updateStreakCount(req.user._id, timezone);
    //     // await UserStreakModel.trackMealMilestones(req.user._id, timezone);
    //     // await UserStreakModel.trackNutritionMilestones(req.user._id, req.user, timezone);

    //     return response.success("success.addedToTracker", res, true);
    // }
}

module.exports = new UserMealController;
