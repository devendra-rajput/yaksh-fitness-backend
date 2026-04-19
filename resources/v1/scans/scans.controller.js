const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone')

/** Custom Require **/
const response = require('../../../helpers/v1/response.helpers');

const openAIService = require('../../../services/openAI');
const geminiService = require('../../../services/gemini');
const ScanModel = require('./scans.model');
const UserModel = require('../users/users.model');
const IngredientImageModel = require('../ingredient_images/ingredient_images.model');
const UserMealModel = require('../user_meals/user_meals.model')
const UserStreakModel = require('../user_streaks/user_streaks.model');
const aws = require("../../../services/aws");
const pythonAPIService = require("../../../services/python_API");
const dataHelper = require('../../../helpers/v1/data.helpers');
const UserTokenModel = require('../user_tokens/user_tokens.model');

class ScanController {

    scanBody = async (req, res) => {
        console.log('ScanController@scanBody');

        // if (!req?.file?.path) {
        //     return response.badRequest("validation.imageNotUploaded", res, false);
        // }
        // // console.log(req.file.path, '========req.file.path');
        const timezone = req.timezone;
        const user = req.user;

        // Convert user height into CM
        let userHeightInCm = req.body.height;
        if (!userHeightInCm) {
            switch (user.height_unit) {
                case UserModel.heightUnits.FT:
                    userHeightInCm = Number(user.height) * 30.48; // 1 foot = 30.48 cm
                    break;

                case UserModel.heightUnits.IN:
                    userHeightInCm = Number(user.height) * 2.54; // 1 inch = 2.54 cm
                    break;

                default:
                    userHeightInCm = user.height;
                    break;
            }
        }

        // Convert user weight into Kgs
        let userWeightInKg = req.body.weight;
        if (!userWeightInKg) {
            userWeightInKg = user.weight;
            if (user.weight_unit == UserModel.weightUnits.LB) {
                userWeightInKg = Number(user.weight) * 0.453592 // 1 lb = 0.453592 kg
            }
        }

        const userAge = req.body?.age || user.age;
        if (!userAge || !userHeightInCm || !userWeightInKg || !user.gender) {
            return response.badRequest("validation.userInfoRequired", res, false);
        }

        // Previous scan data to generate the AI summary
        const previousScanObj = await ScanModel.getLastScan('user_id', user._id);
        let previousBodyReport;
        if (previousScanObj?.body_report) {
            previousBodyReport = previousScanObj.body_report;
        }

        const personInfo = {
            user_id: user._id,
            age: userAge,
            height: userHeightInCm, // In cm
            weight: userWeightInKg, // In Kgs
            gender: user.gender
        };
        // console.log(personInfo, "===========personInfo");

        const filePath = path.join(__dirname, '../../../', req.file.path)
        // console.log(filePath, "=======filePath");

        const fileUrl = `${req.protocol}://${req.get('host')}/${filePath}`;
        console.log(fileUrl, '=========fileUrl');

        const openAIResponse = await openAIService.analyzeBodyScan(filePath, personInfo, previousBodyReport);
        // console.log(openAIResponse, '=================openAIResponse');
        if (!openAIResponse?.status) {
            return response.exception(openAIResponse.message, res, openAIResponse);
        }

        let scanObj;
        // if(openAIResponse?.is_cache){
        //     scanObj = openAIResponse.data;
        // }
        // else {
        const imageUrl = await aws.uploadScanedFile(req)

        const scanData = {
            user_id: user._id,
            type: 'body',
            image_url: imageUrl,
            body_metrics: openAIResponse.metrics,
            body_report: openAIResponse.data,
            age: userAge,
            height: userHeightInCm,
            height_unit: req.body?.height ? "cm" : user.height_unit,
            weight: userWeightInKg,
            weight_unit: req.body?.weight ? "Kgs" : user.weight_unit,
            ai_summary: openAIResponse.data?.ai_summary
        }

        scanObj = await ScanModel.createOne(scanData);
        if (!scanObj) {
            return response.exception("error.serverError", res, false);
        }
        // }

        // if(req.body.step && user.step < req.body.step){
        //     await UserModel.updateOne(user._id, {step: req.body.step});
        // }


        // Delete file after uploading to S3
        if (fs.existsSync(filePath)) {

            // Send image to python API to generate a model
            const webhookUrl = `${req.protocol}://${req.get('host')}/api/v1/scans/model-webhook`;
            const apiData = {
                user_id: user._id.toString(),
                scan_id: scanObj._id.toString(),
                url: webhookUrl
            }

            await pythonAPIService.generateModel(filePath, apiData);

            fs.unlinkSync(filePath);
        }

        // Update User Streak and Milestones
        await UserStreakModel.updateStreakCount(user._id, timezone)
        await UserStreakModel.trackScanMilestones(user._id, 'body', timezone);

        await UserTokenModel.addActivityTokens(user._id, timezone, 'body_scan');

        return response.success("success.scanResult", res, scanObj);
    }

    // scanFood = async (req, res) => {
    //     console.log('ScanController@scanFood');

    //     const timezone = req.timezone || 'UTC';

    //     if (!req?.file?.path) {
    //         return response.badRequest("validation.imageNotUploaded", res, false);
    //     }

    //     /** Convert file path into a public URL */
    //     const filePath = req.file.path.replace(/\\/g, '/');
    //     const fileUrl = `${req.protocol}://${req.get('host')}/${filePath}`;

    //     const openAIResponse = await openAIService.analyzeFoodScan(fileUrl);
    //     // console.log(JSON.stringify(openAIResponse, null, 2), '=================openAIResponse');
    //     if (!openAIResponse?.status) {
    //         return response.exception(openAIResponse.message, res, openAIResponse);
    //     }

    //     /** Generate Ingredients Images */
    //     const ingredients = openAIResponse.data?.ingredients?.length ? openAIResponse.data.ingredients : [];
    //     const substitutions = openAIResponse.data?.substitutions?.length ? openAIResponse.data.substitutions : [];

    //     /** Combined the ingredients and substitutions provide by the Open AI */
    //     const ingredientsAndSubstitutions = [...ingredients, ...substitutions];

    //     let ingredientImagesCollection = [];
    //     let ingredientsToBeGenerateImages = [];
    //     let ingredientsAlreadyGeneratedImages = [];

    //     /** Filtered out the  ingredientsAndSubstitutions on the basis of alreaddy store ingredient images in DB*/
    //     if (ingredientsAndSubstitutions?.length) {
    //         const ingredientTitles = await ingredientsAndSubstitutions.map(item => item.title);
    //         ingredientImagesCollection = await IngredientImageModel.getAll({ titles_arr: ingredientTitles });

    //         for (let ingredientAndSubstitution of ingredientsAndSubstitutions) {
    //             if (ingredientImagesCollection?.length) {
    //                 const ingredientImageObj = await ingredientImagesCollection.find(item => item.title == ingredientAndSubstitution.title);
    //                 if (ingredientImageObj) {
    //                     ingredientAndSubstitution.image = ingredientImageObj.image;
    //                     ingredientsAlreadyGeneratedImages.push(ingredientAndSubstitution);
    //                 }
    //                 else {
    //                     ingredientsToBeGenerateImages.push(ingredientAndSubstitution);
    //                 }
    //             }
    //             else {
    //                 ingredientsToBeGenerateImages.push(ingredientAndSubstitution);
    //             }
    //         }
    //     }

    //     /** Upload AI images on s3 bucket */
    //     let ingredientsWithS3Images = [];
    //     if (ingredientsToBeGenerateImages?.length) {
    //         /** Generate ingredient images using Opne AI */
    //         const itemsWithAIImages = await openAIService.generateAllImages(ingredientsToBeGenerateImages);
    //         if (itemsWithAIImages?.status && itemsWithAIImages?.data?.length) {

    //             /** Upload ingredient images on S3 bucket */
    //             const itemsWithS3Images = await aws.uploadIngredientImages(itemsWithAIImages.data);
    //             if (itemsWithS3Images?.status && itemsWithS3Images?.data?.length) {

    //                 /** Store ingredient images in DB */
    //                 ingredientsWithS3Images = await itemsWithS3Images.data.filter(item => item.image)
    //                 if (ingredientsWithS3Images?.length)
    //                     await IngredientImageModel.createBulk(ingredientsWithS3Images)
    //             }
    //         }
    //     }

    //     /** Replace AI images with S3 bucket images inside ingredients and substitutions */
    //     ingredientsWithS3Images = [...ingredientsWithS3Images, ...ingredientsAlreadyGeneratedImages];

    //     let updatedIngredients = [];
    //     let updatedSubstitutions = [];

    //     for (let ingredient of ingredients) {
    //         const matchedItem = await ingredientsWithS3Images.find(item => item.title == ingredient.title);
    //         if (matchedItem) {
    //             ingredient.image = matchedItem.image;
    //             updatedIngredients.push(ingredient);
    //         }
    //         else {
    //             updatedIngredients.push(ingredient);
    //         }
    //     }

    //     for (let substitution of substitutions) {
    //         const matchedItem = await ingredientsWithS3Images.find(item => item.title == substitution.title);
    //         if (matchedItem) {
    //             substitution.image = matchedItem.image;
    //             updatedSubstitutions.push(substitution);
    //         }
    //         else {
    //             updatedSubstitutions.push(substitution);
    //         }
    //     }
    //     /** End Generate Ingredients Images */

    //     let scanObj;
    //     const imageUrl = await aws.uploadScanedFile(req)

    //     const scanData = {
    //         user_id: req.user._id,
    //         type: 'food',
    //         image_url: imageUrl,
    //         food_report: {
    //             food_name: openAIResponse.data.food_name ?? 0,
    //             calories: openAIResponse.data.calories ?? 0,
    //             protien: openAIResponse.data.protien ?? 0,
    //             fats: openAIResponse.data.fats ?? 0,
    //             carbs: openAIResponse.data.carbs ?? 0,
    //             quality_rating: openAIResponse.data.quality_rating ?? 0,
    //             quality_rating_title: openAIResponse.data.quality_rating_title ?? "",
    //             tags: openAIResponse.data.tags ?? []
    //         },
    //         ai_summary: openAIResponse.data.ai_summary ?? "",
    //         food_ingredients: updatedIngredients ?? [],
    //         food_substitutions: updatedSubstitutions ?? []
    //     }

    //     scanObj = await ScanModel.createOne(scanData);
    //     if (!scanObj) {
    //         return response.exception("error.serverError", res, false);
    //     }

    //     // Update User Streak and Milestones
    //     // await UserStreakModel.updateStreakCount(req.user._id, timezone)
    //     // await UserStreakModel.trackScanMilestones(req.user._id, 'food', timezone);

    //     return response.success("success.scanResult", res, scanObj);
    // }

    scanMenu = async (req, res) => {
        console.log('ScanController@scanMenu');

        const timezone = req.timezone;
        if (!req?.file?.path) {
            return response.badRequest("validation.imageNotUploaded", res, false);
        }

        /** Convert file path into a public URL */
        // const filePath = req.file.path.replace(/\\/g, '/');
        // const fileUrl = `${req.protocol}://${req.get('host')}/${filePath}`;
        // const openAIResponse = await openAIService.analyzeMenuScan(fileUrl);

        const filePath = path.join(__dirname, '../../../', req.file.path)
        const openAIResponse = await geminiService.analyzeMenuScan(filePath);

        if (!openAIResponse?.status) {
            return response.exception(openAIResponse.message, res, openAIResponse);
        }

        let scanObj;
        const imageUrl = await aws.uploadScanedFile(req)

        const menuReportDataArr = [];
        for (let menuItemData of openAIResponse.data) {
            menuReportDataArr.push({
                food_name: menuItemData.food_name ?? 0,
                fiber: menuItemData.fiber ?? 0,
                calories: menuItemData.calories ?? 0,
                protein: menuItemData.protien ?? 0,
                fats: menuItemData.fats ?? 0,
                carbs: menuItemData.carbs ?? 0,
                quality_rating: menuItemData.quality_rating ?? 0,
                ai_summary: menuItemData.ai_summary ?? "",
                tags: menuItemData.tags ?? [],
                ingredients: menuItemData.ingredients ?? []
            })
        }

        const scanData = {
            user_id: req.user._id,
            type: 'menu',
            image_url: imageUrl,
            menu_report: menuReportDataArr
        }

        scanObj = await ScanModel.createOne(scanData);
        if (!scanObj) {
            return response.exception("error.serverError", res, false);
        }

        // Update User Streak and Milestones
        await UserStreakModel.updateStreakCount(req.user._id, timezone)
        await UserStreakModel.trackScanMilestones(req.user._id, 'menu', timezone);

        return response.success("success.scanResult", res, scanObj);
    }

    getBodyStats = async (req, res) => {
        console.log('ScanController@getBodyStats');

        const user = req.user
        const params = {
            weight: user.weight,
            weight_unit: user.weight_unit,
        }
        const scanComparison = await ScanModel.getScanComparison(user._id, params);

        const lastScan = await ScanModel.getLastScan('user_id', user._id, { type: 'body' });

        const endDate = moment().toDate();
        const startDate = moment().subtract(30, 'day').startOf('day').toDate();

        let filterObj = {
            user_id: user._id,
            start_date: startDate,
            end_date: endDate
        }
        const { group_data, last_30_days_data, overall_data } = await ScanModel.getProgressGraphData(filterObj);

        /** Start Graph Calculation */
        let labels = [];
        let weightDataSet = [];
        let muscleDataSet = [];
        let fatDataSet = [];
        let datesArray = [];
        const today = new Date();

        for (let i = 0; i < 30; i++) {
            const pastDate = new Date();
            pastDate.setDate(today.getDate() - i);

            const formattedDate = pastDate.toISOString().split('T')[0];
            datesArray.push(formattedDate);
        }

        datesArray = datesArray.reverse();

        let dayIndex = 1;
        for (let monthDate of datesArray) {

            labels.push("Day " + dayIndex);
            dayIndex++

            const matchedScan = await group_data.find(item => moment(item.date).format('YYYY-MM-DD') == monthDate);
            if (matchedScan?.average_weight) {
                weightDataSet.push(matchedScan.average_weight);
            }
            else {
                weightDataSet.push(0);
            }

            if (matchedScan?.average_muscle_weight) {
                muscleDataSet.push(matchedScan.average_muscle_weight);
            }
            else {
                muscleDataSet.push(0);
            }

            if (matchedScan?.average_body_fat) {
                fatDataSet.push(matchedScan.average_body_fat);
            }
            else {
                fatDataSet.push(0);
            }
        }
        /** End Graph Calculation */

        /** Progress Calculation */
        const calculateProgress = (scans, metric) => {
            // console.log(metric, '=========metric');

            if (!scans || scans.length < 2) {
                return { progress: 0 };
            }

            // Sort scans by created_at ascending (oldest first)
            const sorted = scans.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            let firstScan = sorted[0];
            let latestScan = sorted[sorted.length - 1];
            // console.log(firstScan, '=========firstScan');
            // console.log(latestScan, '=========latestScan');

            if (metric == 'weight') {
                firstScan = firstScan.weight
                latestScan = latestScan.weight
            }
            else if (metric == 'muscle') {
                firstScan = firstScan?.body_report?.muscle_development?.muscle_weight
                latestScan = latestScan?.body_report?.muscle_development?.muscle_weight
            }
            else if (metric == 'fat') {
                firstScan = firstScan?.body_report?.body_composition?.body_fat
                latestScan = latestScan?.body_report?.body_composition?.body_fat
            }

            if (!firstScan || firstScan === 0) {
                return { progress: 0 };
            }

            // console.log(firstScan, '=========firstScan 2');
            // console.log(latestScan, '=========latestScan 2');

            const progress = ((latestScan - firstScan) / firstScan) * 100;

            return { progress: progress };
        }
        /** End progress calculation */

        const result = {
            key_stats: scanComparison,
            ai_summary: lastScan.ai_summary,
            overall_progress: {
                weight: calculateProgress(overall_data, 'weight'),
                muscle: calculateProgress(overall_data, 'muscle'),
                fat: calculateProgress(overall_data, 'fat')
            },
            last_30_days: {
                weight: calculateProgress(last_30_days_data, 'weight'),
                muscle: calculateProgress(last_30_days_data, 'muscle'),
                fat: calculateProgress(last_30_days_data, 'fat')
            },
            graph_data: {
                weight: {
                    labels: labels,
                    data_set: weightDataSet
                },
                muscle: {
                    labels: labels,
                    data_set: muscleDataSet
                },
                fat: {
                    labels: labels,
                    data_set: fatDataSet
                }
            }
        }

        // console.log(JSON.stringify(result), "===========result");
        return response.success("success.goalsData", res, result);
    }

    getAllWithPagination = async (req, res) => {
        console.log('ScanController@getAllWithPagination');

        /** Extract the page and limt from query param */
        const { page, limit } = await dataHelper.getPageAndLimit(req.query);

        let filterObj = {
            user_id: req.query.user_id ?? req.user._id,
            type: req.query.type
        };

        const result = await ScanModel.getAllWithPagination(page, limit, filterObj);
        if (!result?.data?.length) {
            return response.success("success.noRecordsFound", res, result);
        }

        // if(req.query.type == 'food'){
        //     const allFoods = await result.data.flatMap(item => item.foods || []);
        //     result.data = allFoods;
        // }

        return response.success("success.scansData", res, result);
    }

    modelWebhook = async (req, res) => {
        console.log('ScanController@modelWebhook');

        const { user_id, scan_id, model_url, model_type } = req.body;

        const scanObj = await ScanModel.getOneByColumnNameAndValue("_id", scan_id);
        if (scanObj?._id && (model_url || model_type)) {

            const dataToUpdate = {};
            if (model_url) {
                dataToUpdate.model_url = model_url
            }

            if (model_type) {
                dataToUpdate.model_type = model_type
            }

            await ScanModel.updateOne(scanObj._id, dataToUpdate);
        }

        return response.success("Webhook succeeded", res, true);
    }

    uploadImageAWS = async (req, res) => {
        console.log('ScanController@uploadImageAWS');

        return response.success("success.fileUploaded", res, { image_url: req.image_url });
    }

    scanFoodLog = async (req, res) => {
        console.log('ScanController@scanFoodLog');

        const timezone = req.timezone;
        const scanData = {
            user_id: req.user._id,
            type: ScanModel.scanTypes.FOOD,
            foods: req.body.meals
        }
        const scanObj = await ScanModel.createOne(scanData);
        if (!scanObj) {
            return response.success("error.serverError", res, false);
        }

        //Add food scan data in user meals also
        if (scanObj?.foods?.length) {
            for (let meal of scanObj?.foods) {
                const userMealData = {
                    user_id: req.user._id,
                    scan_food_id: meal._id,
                    recognised_food_name: meal.recognised_food_name,
                    food_name: meal.food_name,
                    food_type: meal.food_type,
                    nutrition: meal.nutrition,
                    score: meal.score,
                    brand_name: meal.brand_name,
                    tags: meal.tags,
                    weight_grams: meal.weight_grams,
                    portion_size: meal.portion_size,
                    meal_time: meal.meal_time,
                    consumed_qty: meal.consumed_qty
                }
                await UserMealModel.createOne(userMealData);
            }
        }

        // Update User Streak and Milestones
        await UserStreakModel.updateStreakCount(req.user._id, timezone)
        await UserStreakModel.trackScanMilestones(req.user._id, 'food', timezone);
        await UserStreakModel.trackNutritionMilestones(req.user._id, req.user, timezone);

        return response.success("success.scanedFoodAddedToHistory", res, true);
    }

    deleteHistory = async (req, res) => {
        console.log('ScanController@deleteHistory');

        const { scan_id, food_id, type } = req.body

        // Validate if scan exists
        const scanObj = await ScanModel.getOneByColumnNameAndValue('_id', scan_id);
        if (!scanObj) {
            return response.badRequest("error.scanIdNotFound", res, false);
        }

        if (type == ScanModel.scanTypes.FOOD) {
            const scanData = {
                scan_id: scan_id,
                food_id: food_id,
                user_id: req.user._id
            }

            const isDeleted = await ScanModel.deleteFoodScanItem(scanData);
            if (!isDeleted) {
                return response.exception("error.serverError", res, false);
            }

            // Delete user meal also with the scan food id
            await UserMealModel.deleteOneByScanFoodId(food_id)

            // If no foods left, delete the scan
            if (!scanObj.foods || scanObj.foods.length <= 1) {
                await ScanModel.deleteOne(scan_id);
            }
        }
        else if (type == ScanModel.scanTypes.BODY) {
            const hasDeleted = await ScanModel.deleteOne(scan_id)
            if (!hasDeleted) {
                return response.exception("error.severError", res, false)
            }
        }

        return response.success(type === 'food' ? "success.foodItemDeleted" : "success.bodyScanDeleted", res, true);
    }

    getScanResult = async (req, res) => {
        console.log('ScanController@getScanResult');

        const scanResult = await ScanModel.getOneByColumnNameAndValue("_id", req.params.id);
        if (!scanResult) {
            return response.badRequest("error.scanIdNotFound", res, false);
        }

        return response.created("success.scanResult", res, scanResult);
    }

}

module.exports = new ScanController;
