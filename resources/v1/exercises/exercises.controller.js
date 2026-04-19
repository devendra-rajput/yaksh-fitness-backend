/** Custom Require **/
const mongoose = require("mongoose");
const moment = require('moment')

const response = require('../../../helpers/v1/response.helpers');
const dataHelper = require('../../../helpers/v1/data.helpers');
const awsServices = require('../../../services/aws');
const ffmpegServices = require('../../../services/ffmpeg');

const ExercisesModel = require("./exercises.model");
const EquipmentsModel = require("../equipments/equipments.model");
const MuscleGroupsModel = require("../muscle_groups/muscle_groups.model");
const UsersModel = require('../users/users.model');
const TodayWorkoutModel = require('../today_workouts/today_workouts.model')

class ExercisesController {

    importExercises = async (req, res) => {
        console.log("ExercisesController@importExercises");

        try {

            if (!req.file) {
                return response.exception("error.fileRequired", res, false);
            }

            let exerciseData = await dataHelper.fileToJson(req.file);

            let importedExercisesCount = 0;
            let duplicateExercisesCount = 0;
            let notImportedExerciseCount = 0;

            for (let exercise of exerciseData) {

                const exerciseCategory = exercise["Category for exercises distribution"]?.trim() || '';
                const workoutSplitCategory = exercise["Workout Split category ONLY for fitness Plan"]?.trim() || '';

                const videoName = exercise["Video Name"]?.trim();
                const folder = exercise["folder"]?.trim() || "";
                const folderName = folder.charAt(0).toUpperCase() + folder.slice(1).toLowerCase();

                let videoUrl = `https://${process.env.AWS_S3_EXERCISE_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${folderName}/${videoName}.mp4`
                let thumbnailUrl = null;

                const title = exercise["Exercise Name"]?.trim();
                if (!title) {
                    console.log("Title not found!");
                    notImportedExerciseCount += 1;
                    continue;
                }

                let existingExercise = await ExercisesModel.getOneByColumnNameAndValue("title", title);
                if (existingExercise) {
                    console.log("Existing exercise!");

                    if (existingExercise) {
                        let dataToUpdate = {};
                        let isVideoExist = false;
                        if (!existingExercise.thumbnail_url || !existingExercise.video_url) {
                            console.log(videoUrl, "======videoUrl");
                            isVideoExist = await awsServices.isFileExist(videoUrl);
                            console.log(isVideoExist, '=======isVideoExist');
                        }

                        if (!existingExercise.thumbnail_url && isVideoExist) {
                            thumbnailUrl = await ffmpegServices.generateThumbnail(videoUrl);
                            console.log(thumbnailUrl, "======thumbnailUrl");
                            if (thumbnailUrl) {
                                dataToUpdate.thumbnail_url = thumbnailUrl;
                            }
                        }

                        if (!existingExercise.video_url && isVideoExist) {
                            dataToUpdate.video_url = videoUrl;
                        }

                        if (Object.keys(dataToUpdate).length > 0) {
                            await ExercisesModel.updateOne(existingExercise._id, dataToUpdate);
                        }
                    }

                    duplicateExercisesCount += 1;
                    continue;
                }

                const instructions = dataHelper.splitCleanLines(exercise["Exercise Instructions (step by step)"]);
                const tips = dataHelper.splitCleanLines(exercise["Exercise Tips"]);

                // Handle primary muscles
                const primaryMuscles = dataHelper.splitOutsideParentheses(exercise["Primary Activating Muscles"] || "");
                const primaryMuscleGroups = [];

                for (let primaryMuscle of primaryMuscles) {
                    /** If muscle group exist with the title then append it into the primaryMuscleGroups */
                    let existedMuscleGroup = await MuscleGroupsModel.getOneByColumnNameAndValue('title', primaryMuscle);
                    if (existedMuscleGroup) {
                        primaryMuscleGroups.push({
                            id: existedMuscleGroup._id,
                            title: existedMuscleGroup.title
                        })
                    }
                    else {
                        /** If muscle group does not exist with the title then create new one and append it into the primaryMuscleGroups */
                        let muscleGroupObj = await MuscleGroupsModel.createOne({ title: primaryMuscle });
                        primaryMuscleGroups.push({
                            id: muscleGroupObj._id,
                            title: muscleGroupObj.title
                        })
                    }
                }

                // Handle secondary muscles
                const secondaryMuscles = dataHelper.splitOutsideParentheses(exercise["Secondary Activating Muscles"] || "");
                const secondaryMuscleGroups = [];

                for (let secondaryMuscle of secondaryMuscles) {
                    /** If muscle group exist with the title then append it into the secondaryMuscleGroups */
                    let existedMuscleGroup = await MuscleGroupsModel.getOneByColumnNameAndValue('title', secondaryMuscle);
                    if (existedMuscleGroup) {
                        secondaryMuscleGroups.push({
                            id: existedMuscleGroup._id,
                            title: existedMuscleGroup.title
                        })
                    }
                    else {
                        /** If muscle group does not exist with the title then create new one and append it into the secondaryMuscleGroups */
                        let muscleGroupObj = await MuscleGroupsModel.createOne({ title: secondaryMuscle });
                        secondaryMuscleGroups.push({
                            id: muscleGroupObj._id,
                            title: muscleGroupObj.title
                        })
                    }
                }

                // Handle equipments
                const gymEquipments = (exercise["Equipment"] || "").split(",").map(v => v.trim())
                const equipments = [];

                for (let gymEquipment of gymEquipments) {

                    if (/^none\b/i.test(gymEquipment)) {
                        continue;
                    }

                    let equipmentObj = await EquipmentsModel.getOneByColumnNameAndValue('title', gymEquipment);
                    if (!equipmentObj) {

                        const isHomeGymEquipment = await ExercisesModel.isEquipmentExistInLocation(UsersModel.trainingLocations.HOME_GYM, gymEquipment);
                        const isFullGymEquipment = await ExercisesModel.isEquipmentExistInLocation(UsersModel.trainingLocations.FULL_GYM, gymEquipment);
                        const isSmallGymEquipment = await ExercisesModel.isEquipmentExistInLocation(UsersModel.trainingLocations.SMALL_GYM, gymEquipment);
                        let equipmentDefaultWeight = EquipmentsModel.getEquipmentDefaultWeight(gymEquipment)

                        let equipmentData = {
                            title: gymEquipment,
                            in_full_gym: isFullGymEquipment,
                            in_small_gym: isSmallGymEquipment,
                            in_home_gym: isHomeGymEquipment,
                            default_weight: equipmentDefaultWeight
                        }

                        equipmentObj = await EquipmentsModel.createOne(equipmentData);
                    }

                    if (!equipmentObj) {
                        continue;
                    }

                    equipments.push({
                        id: equipmentObj._id,
                        title: equipmentObj.title
                    })
                }

                console.log(videoUrl, "========videoUrl");
                const isVideoExist = await awsServices.isFileExist(videoUrl);
                console.log(isVideoExist, '=======isVideoExist');
                if (isVideoExist) {
                    thumbnailUrl = await ffmpegServices.generateThumbnail(videoUrl);
                }

                const exerciseData = {
                    title,
                    instructions,
                    tips,
                    primary_muscle_groups: primaryMuscleGroups,
                    secondary_muscle_groups: secondaryMuscleGroups,
                    equipments,
                    video_url: videoUrl || '',
                    thumbnail_url: thumbnailUrl || '',
                    exercise_category: exerciseCategory,
                    workout_split_categrory: workoutSplitCategory
                };

                // Create new exercise
                const exerciseObj = await ExercisesModel.createOne(exerciseData);
                if (exerciseObj) {
                    importedExercisesCount += 1;
                }
                else {
                    console.log("Unable to create exercise!");
                    notImportedExerciseCount += 1;
                }
            }

            const result = {
                imported_exercise_count: importedExercisesCount,
                duplicate_exercise_count: duplicateExercisesCount,
                not_imported_exercise_count: notImportedExerciseCount
            }
            return response.success("success.exercisesImported", res, result)

        } catch (err) {
            console.log(err, "=======err");
            return response.exception("error.serverError", res, false)
        }
    };

    getAll = async (req, res) => {
        console.log('ExercisesController@getAll');

        const result = await ExercisesModel.getAll();
        if (!result?.length) {
            return response.success("success.noRecordsFound", res, result);
        }

        return response.success("success.allExercises", res, result);
    }

    getAllWithPagination = async (req, res) => {
        console.log('ExercisesController@getAllWithPagination');

        /** Extract the page and limit from query param */
        const { page, limit } = await dataHelper.getPageAndLimit(req.query);

        const {
            title,
            muscles,
            equipment_id,
            difficulty
        } = req.query;

        let filterObj = {
            title: title,
            muscles: muscles,
            equipment_id: equipment_id
        };

        //Fetch all muscle group ids by muscle group
        let fetchMuscleGroups = await MuscleGroupsModel.findByMuscleKeywords(filterObj)
        let muscleGroupIds = fetchMuscleGroups.map(muscles => muscles._id)

        filterObj = {
            ...filterObj,
            muscle_group_ids: muscleGroupIds
        }

        const result = await ExercisesModel.getAllWithPagination(page, limit, filterObj);
        if (!result?.data?.length) {
            return response.success("success.noRecordsFound", res, result);
        }

        let setAndReps = ExercisesModel.setAndRepsConfiguration.intermediate;

        if (difficulty) {
            switch (difficulty) {
                case UsersModel.experienceLevels.BEGINNER:
                    setAndReps = ExercisesModel.setAndRepsConfiguration.beginner
                    break;

                // case UsersModel.experienceLevels.INTERMEDIATE:
                //     setAndReps = ExercisesModel.setAndRepsConfiguration.intermediate
                //     break;

                case UsersModel.experienceLevels.ADVANCED:
                    setAndReps = ExercisesModel.setAndRepsConfiguration.advanced
                    break;

                default:
                    break;
            }
        }

        const workoutsData = result.data.map((item) => {
            return { ...item, set_and_reps: setAndReps }
        });

        result.data = workoutsData;

        return response.success("success.allExercises", res, result);
    }

    createOrUpdateTodayWorkout = async (workoutsDataObj = {}) => {
        console.log('ExercisesController@createOrUpdateTodayWorkout');
        /** Retrieve the today workouts of the loggedin user */
        const userTodayWorkoutObj = await TodayWorkoutModel.getOneByColumnNameAndValue('user_id', workoutsDataObj?.userId);

        let todayWorkoutData = {
            expires_at: moment().endOf('day').toDate(),
            filter: workoutsDataObj?.filter,
            workouts: workoutsDataObj?.workouts,
            is_setting_updated: false
        }

        /** If today workout data does not exist then create new one otherwise update the expiry of existed data */
        if (!userTodayWorkoutObj?._id) {
            todayWorkoutData = {
                ...todayWorkoutData,
                user_id: workoutsDataObj?.userId
            }
            await TodayWorkoutModel.createOne(todayWorkoutData)
        }
        else {
            await TodayWorkoutModel.updateOne(userTodayWorkoutObj._id, todayWorkoutData)
        }
    }

    generateExercises = async (req, res) => {
        console.log('ExercisesController@generateExercises');

        const userId = req.user._id

        const {
            time,
            location,
            muscles,
            difficulty
        } = req.query;

        // console.log(req.query, "==========req.query");

        let muscleArray = [];
        if (muscles) {
            muscleArray = String(req.query.muscles)
                .split(",")
                .map(m => m.trim())
                .filter(Boolean);
        }

        let filterObj = {
            time: time,
            location: location,
            muscles: muscleArray,
            difficulty: difficulty  // key added to save in today workouts only
        };

        const excludedExercisesForUser = req.user.excluded_exercises
        if (excludedExercisesForUser?.length) {
            filterObj = {
                ...filterObj,
                excluded_exercises: excludedExercisesForUser
            }
        }

        const result = await ExercisesModel.generateExercises(filterObj);
        if (!result?.length) { // Update today workouts data
            let workoutsDataObj = {
                userId: userId,
                filter: req.query,
                workouts: []
            }
            await this.createOrUpdateTodayWorkout(workoutsDataObj)

            return response.success("success.noRecordsFound", res, result);
        }

        let setAndReps = ExercisesModel.setAndRepsConfiguration.intermediate;

        if (difficulty) {
            switch (difficulty) {
                case UsersModel.experienceLevels.BEGINNER:
                    setAndReps = ExercisesModel.setAndRepsConfiguration.beginner
                    break;

                // case UsersModel.experienceLevels.INTERMEDIATE:
                //     setAndReps = ExercisesModel.setAndRepsConfiguration.intermediate
                //     break;

                case UsersModel.experienceLevels.ADVANCED:
                    setAndReps = ExercisesModel.setAndRepsConfiguration.advanced
                    break;

                default:
                    break;
            }
        }

        const workoutsData = result.map((item) => {
            return { ...item, set_and_reps: setAndReps, is_completed: false }
        });

        let todayWorkoutData = {
            userId: userId,
            filter: req.query,
            workouts: workoutsData,
        }

        await this.createOrUpdateTodayWorkout(todayWorkoutData)

        return response.success("success.allExercises", res, workoutsData);
    }

    updateWeeklyFitnessPlan = async (req, res) => {
        console.log('ExercisesController@updateWeeklyFitnessPlan');

        const userId = req.user._id;
        const {
            time = ExercisesModel.defaultExerciseTime.time,
            location,
            muscles,
            difficulty,
            specific_day,
            date,
            is_referesh
        } = req.body;

        let muscleArray = [];
        if (muscles) {
            muscleArray = String(muscles)
                .split(",")
                .map(m => m.trim())
                .filter(Boolean);
        }

        const splits = Object.keys(ExercisesModel.fitnessPlanMuscles);
        const dayNum = parseInt(specific_day);

        const splitIndex = (dayNum - 1) % splits.length;
        const split = splits[splitIndex];

        const targetMuscles = muscleArray.length > 0
            ? muscleArray
            : (ExercisesModel.fitnessPlanMuscles[split] || []);

        let filterObj = {
            time: time,
            location: location,
            muscles: targetMuscles,
            difficulty: difficulty
        };

        const excludedExercisesForUser = req.user.excluded_exercises;
        if (excludedExercisesForUser?.length) {
            filterObj.excluded_exercises = excludedExercisesForUser;
        }

        const exercises = await ExercisesModel.generateExercises(filterObj);

        let resolvedDifficulty =
            difficulty ||
            req.user?.workout_settings?.experience_level ||
            UsersModel.experienceLevels.INTERMEDIATE;

        let setAndReps;

        switch (resolvedDifficulty) {
            case UsersModel.experienceLevels.BEGINNER:
                setAndReps = ExercisesModel.setAndRepsConfiguration.beginner;
                break;

            case UsersModel.experienceLevels.INTERMEDIATE:
                setAndReps = ExercisesModel.setAndRepsConfiguration.intermediate;
                break;

            case UsersModel.experienceLevels.ADVANCED:
                setAndReps = ExercisesModel.setAndRepsConfiguration.advanced;
                break;
        }

        const customizedPlanData = {
            day: dayNum,
            ...(time !== undefined && { time: Number(time) }),
            location: location,
            difficulty: resolvedDifficulty,
            custom_muscles: targetMuscles,
            workouts: (exercises || []).map(item => ({ ...item, set_and_reps: setAndReps, is_completed: false })), 
            date: date
        };

        if (is_referesh == true) {
            const updateWorkout = await UsersModel.updateWeeklyWorkoutPlanDay(userId, customizedPlanData, req.user.weekly_fitness_plan);
            if (!updateWorkout) {
                return response.exception("error.serverError", res, false);
            }
        }

        else {
            const updatedUser = await UsersModel.updateCustomizedPlanDay(userId, customizedPlanData, req.user.weekly_fitness_plan);
            if (!updatedUser) {
                return response.exception("error.serverError", res, false);
            }
        }

        const userDetails = await UsersModel.getOneByColumnNameAndValue('_id', userId);
        
        return response.success("success.weeklyPlanUpdated", res, userDetails);
    }

    excludeExerciseForUser = async (req, res) => {
        console.log("ExercisesController@excludeExerciseForUser");

        const userId = req.user._id
        const exerciseId = new mongoose.Types.ObjectId(req.params.id);

        const checkExerciseId = await ExercisesModel.getOneByColumnNameAndValue('_id', exerciseId)
        if (!checkExerciseId) {
            return response.notFound("error.exerciseNotFound", res, false)
        }

        const excludeExercise = await UsersModel.updateOne(userId, { $addToSet: { excluded_exercises: exerciseId } })
        if (!excludeExercise) {
            return response.exception("error.serverError", res, null);
        }

        return response.success("success.exerciseExcludedForUser", res, true);
    }

    generateWeeklyWorkoutPlan = async (req, res) => {
        console.log('ExercisesController@generateWeeklyWorkoutPlan');

        const userId = req.user._id;
        const { difficulty, equipment_ids } = req.body;

        // Generate user's weekly fitness plan with default values
        const splits = Object.keys(ExercisesModel.fitnessPlanMuscles); // ['Push', 'Pull', 'Legs'] 
        const weeklySchedule = [];

        for (let day = 1; day <= 7; day++) {
            let split;
            let targetMuscles = [];

            if (day === 7) {
                weeklySchedule.push({ day, custom_muscles: [], workouts: [] });
                continue;
            } else {
                const splitIndex = (day - 1) % splits.length;
                split = splits[splitIndex];
                targetMuscles = ExercisesModel.fitnessPlanMuscles[split] || [];
            }

            let defaultExerciseTime = ExercisesModel.defaultExerciseTime.time
            let filterObj = {
                time: defaultExerciseTime,
                muscles: targetMuscles,
                equipment_ids: equipment_ids
            };

            const exercises = await ExercisesModel.generateExercises(filterObj);

            let difficultyLevel = difficulty || req.user?.workout_settings?.experience_level || UsersModel.experienceLevels.INTERMEDIATE;

            let setAndReps;

            switch (difficultyLevel) {
                case UsersModel.experienceLevels.BEGINNER:
                    setAndReps = ExercisesModel.setAndRepsConfiguration.beginner;
                    break;

                case UsersModel.experienceLevels.INTERMEDIATE:
                    setAndReps = ExercisesModel.setAndRepsConfiguration.intermediate;
                    break;

                case UsersModel.experienceLevels.ADVANCED:
                    setAndReps = ExercisesModel.setAndRepsConfiguration.advanced;
                    break;
            }

            weeklySchedule.push({
                day: day,
                time: defaultExerciseTime,
                custom_muscles: targetMuscles,
                difficulty: difficultyLevel,
                workouts: (exercises || []).map(item => ({ ...item, set_and_reps: setAndReps, is_completed: false }))
            });
        }

        let dataToUpdate = {
            'weekly_fitness_plan.weekly_schedule': weeklySchedule
        }

        /* Insert the data into DB */
        const updateFitnessPlan = await UsersModel.upsertFitnessPlan(userId, dataToUpdate);
        if (!updateFitnessPlan) {
            return response.exception("error.serverError", res, false);
        }

        return response.created('success.weeklyPlanUpdated', res, updateFitnessPlan);
    }

}

module.exports = new ExercisesController();
