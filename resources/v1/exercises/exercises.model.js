/** Custom Require **/
const Exercises = require('./exercises.schema');

const dataHelper = require('../../../helpers/v1/data.helpers');
const EquipmentModel = require('../equipments/equipments.model');
const UserModel = require('../users/users.model');

const fullGymIncludedEquipments = [
    "Barbell",
    "Dumbbells",
    "Machines",
    "Hack Squat",
    "Dual Pulley / Crossover Machine",
    "Dip/Pull-Up Station",
    "Bench",
    "Squat Rack",
    "Kettlebells",
    "Ab Wheel / Ab Roller"
]

const smallGymIncludedEquipments = [
    "Dumbbells",
    "Bench",
    "Kettlebells",
    "Machines",
    "Pull-Up Bar",
    "Dip Station",
    "Ab Wheel",
    "Row Machine",
    "Exercise Ball"
]

const smallGymExcludedEquipments = [
    "Smith Machine",
    "Leg Press",
    "Plate-loaded machines",
    "Heavy barbell movements",
    "Hack Squat"
]

const homeGymIncludedEquipments = [
    "Dumbbells",
    "Bench",
    "Kettlebells",
    "Ab Wheel",
    "Exercise Ball"
]

const homeGymExcludedEquipments = [
    "Machines"
]

const locationFieldMap = {
    "Full Gym": "in_full_gym",
    "Small Gym": "in_small_gym",
    "Home Gym": "in_home_gym",
    "No Equipment": "no_equipment"
};

const setAndRepsConfiguration = {
    beginner: {
        sets: "3",
        reps: "10-12",
        weight: "15-25",
        weight_unit: "lbs"
    },
    intermediate: {
        sets: "4",
        reps: "8-12",
        weight: "30-50",
        weight_unit: "lbs"
    },
    advanced: {
        sets: "4-5",
        reps: "6-10",
        weight: "55-80",
        weight_unit: "lbs"
    }
};

const fitnessPlanMuscles = {
    Push: ['Chest', 'Shoulders', 'Triceps'],
    Pull: ['Back', 'Rear delts', 'Biceps'],
    Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves']
}

const defaultExerciseTime = {
   time: '30' // In minutes
}

class ExercisesModel {

    constructor() {
        this.fullGymIncludedEquipments = fullGymIncludedEquipments;
        this.smallGymIncludedEquipments = smallGymIncludedEquipments;
        this.smallGymExcludedEquipments = smallGymExcludedEquipments;
        this.homeGymIncludedEquipments = homeGymIncludedEquipments;
        this.homeGymExcludedEquipments = homeGymExcludedEquipments;
        this.setAndRepsConfiguration = setAndRepsConfiguration
        this.fitnessPlanMuscles = fitnessPlanMuscles;
        this.locationFieldMap = locationFieldMap
        this.defaultExerciseTime = defaultExerciseTime;
    }

    createOne = async (data) => {
        console.log('ExercisesModel@createOne');
        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            let result = await Exercises.create(data);
            if (!result) {
                return false;
            }
            return result;
        } catch (error) {
            console.log("Error EquipmentsModel@createOne: ", error);
            return false;
        }
    }

    getAll = async () => {
        console.log('ExercisesModel@getAll');
        try {

            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            }

            let results = await Exercises.find(dbQuery).collation({ locale: 'en', strength: 2 });
            if (!results) {
                return false;
            }

            return results;
        } catch (error) {
            console.log("Error ExercisesModel@getAll: ", error);
            return false;
        }
    }


    getAllWithPagination = async (page, limit, filterObj = {}) => {
        console.log('ExercisesModel@getAllWithPagination');

        try {
            // Build base query
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },
            };

            if (filterObj?.title) {
                dbQuery = {
                    ...dbQuery,
                    title: { $regex: filterObj.title, $options: "i" }
                }
            }

            if (filterObj?.muscle_group_ids.length) {
                const muscleGroupIds = filterObj.muscle_group_ids.map(id => id.toString());

                dbQuery = {
                    ...dbQuery,
                    primary_muscle_groups: {
                        $elemMatch: { id: { $in: muscleGroupIds } }
                    }
                };
            }

            if (filterObj?.equipment_id) {
                const equipmentGroupIdArray = filterObj.equipment_id.split(',').map(i => i.trim());
                dbQuery = {
                    ...dbQuery,
                    'equipments.id': { $in: equipmentGroupIdArray }
                }
            }

            let aggregationArr = [
                { $match: dbQuery }
            ];

            let totalRecords = await Exercises.countDocuments(dbQuery);

            let pagination = await dataHelper.calculatePagination(totalRecords, page, limit);

            let ExercisesData = await Exercises.aggregate(aggregationArr).sort({ createdAt: -1 })
                .skip(pagination.offset)
                .limit(pagination.limit);

            return {
                data: ExercisesData,
                pagination: {
                    total: totalRecords,
                    current_page: pagination.currentPage,
                    total_pages: pagination.totalPages,
                    per_page: pagination.limit
                }
            };
        } catch (error) {
            console.error("Error ExercisesModel@getAllWithPagination: ", error);
            return false;
        }
    };


    getOneByColumnNameAndValue = async (columnName, columnValue) => {
        console.log('ExercisesModel@getOneByColumnNameAndValue');
        try {
            let query = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            }

            let result = await Exercises.findOne(query).collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;
        } catch (error) {
            console.log("Error ExercisesModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }


    generateExercises = async (filterObj = {}) => {
        console.log('ExercisesModel@generateExercises');
        try {
            let dbQuery = { deleted_at: { $in: [null, '', ' '] } };
            // exclude exercises remvoed from response
            if (Array.isArray(filterObj.excluded_exercises) && filterObj.excluded_exercises.length > 0) {
                dbQuery._id = { $nin: filterObj.excluded_exercises };
            }

            // 1. Calculate workout parameters based on time
            const time = Number(filterObj?.time || 0);

            // Get exercise count and pattern from helper function
            // Example: 45 min → {total: 6, pattern: ['C', 'C', 'I', 'I', 'I', 'I']}
            const exerciseLimit = dataHelper.getExerciseLimitByDuration(time);
            const totalExercises = exerciseLimit.total;

            if (totalExercises <= 0) return [];

            // 2. Apply equipment filter based on user's training location
            if (filterObj?.location) {
                const userLocationPreference = filterObj.location.trim();

                // "No Equipment" location: only bodyweight exercises
                if (userLocationPreference === 'No Equipment') {
                    const bodyWeightEquipments = await EquipmentModel.getAll(
                        { title: "Bodyweight" },
                        { _id: 1 }
                    );
                    const bodyWeightIds = bodyWeightEquipments.map(e => e._id.toString());

                    dbQuery.$and = [
                        {
                            $or: [
                                { equipments: { $exists: false } },
                                { equipments: { $size: 0 } },
                                { 'equipments.id': { $in: bodyWeightIds } }
                            ]
                        }
                    ];

                    // "Full Gym" location: all equipment allowed
                } else if (userLocationPreference === 'Full Gym') {
                    const allEquipments = await EquipmentModel.getAll({}, { _id: 1 });
                    dbQuery['equipments.id'] = { $in: allEquipments.map(e => e._id.toString()) };

                    // Other locations (Small Gym, Home Gym): specific equipment only
                } else {
                    const locationType = locationFieldMap[userLocationPreference];
                    if (locationType) {
                        const gymEquipments = await EquipmentModel.getAll({ [locationType]: true }, { _id: 1 });
                        dbQuery['equipments.id'] = { $in: gymEquipments.map(e => e._id.toString()) };
                    }
                }
            }
            else if(filterObj?.equipment_ids?.length){
                const gymEquipments = await EquipmentModel.getAll({ _id: { $in: filterObj.equipment_ids } }, { _id: 1 });
                dbQuery['equipments.id'] = { $in: gymEquipments.map(e => e._id.toString()) };
            }

            // 3. Apply muscle filter based on user's selected muscles
            let muscleKeywords = [];
            if (Array.isArray(filterObj.muscles) && filterObj.muscles.length > 0) {
                muscleKeywords = filterObj.muscles.map(m => String(m).trim()).filter(Boolean);
            }

            // Check if user selected "Full Body" (special case)
            const isFullBody = muscleKeywords.some(m => m.toLowerCase() === 'full body');

            // Check if user selected core muscles (abs/abdominals/obliques)
            const includeCore = muscleKeywords.some(m =>
                ['abs', 'abdominals', 'obliques', 'core'].includes(m.toLowerCase())
            );

            // Handle Full Body fallback if no muscles selected
            if (isFullBody && muscleKeywords.filter(m => m.toLowerCase() !== 'full body').length === 0) {
                // Default full body muscles if none specified
                // if it's Full Body, we don't strictly filter by muscle in the DB query to allow variety
            } else if (!isFullBody && muscleKeywords.length > 0) {
                const orConditions = muscleKeywords.flatMap(keyword => {
                    const lower = keyword.toLowerCase();

                    //biceps ≠ biceps femoris
                    if (lower === 'biceps') {
                        return [
                            {
                                "primary_muscle_groups": {
                                    $elemMatch: {
                                        title: { $regex: /^biceps(?!\s*femoris)/i }
                                    }
                                }
                            }
                        ];
                    }

                    // default strict word match
                    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                    return [
                        {
                            "primary_muscle_groups": {
                                $elemMatch: { title: { $regex: regex } }
                            }
                        }
                    ];
                });

                dbQuery.$or = orConditions;
            }

            // 4. Fetch exercises from database
            const exercises = await Exercises.find(dbQuery).lean();
            if (exercises.length === 0) return []; // No matching exercises found

            // 5. Organize exercises by muscle and type
            const muscleExercisesMap = {};

            // Initialize empty arrays for each selected muscle
            muscleKeywords.forEach(muscle => {
                muscleExercisesMap[muscle.toLowerCase()] = {
                    compound: [],
                    isolation: [],
                    core: [],
                    bodyweight: []
                };
            });

            // Categorize each exercise
            exercises.forEach(ex => {
                const category = ex.exercise_category?.toLowerCase() || 'isolation';

                // Skip bodyweight exercises if location is not "no equipment"
                if (category === 'bodyweight' && filterObj.location?.toLowerCase() !== 'no equipment') return;

                // Skip core exercises if user didn't select abs/abdominals
                if (category === 'core' && !includeCore) return;

                // Find which selected muscle this exercise belongs to
                let assignedMuscle = null;

                // Helper function to check if a muscle group matches selected muscles
                const checkMuscleMatch = (muscleGroup) => {
                    const muscleName = muscleGroup.title?.toLowerCase();
                    for (const selectedMuscle of muscleKeywords) {
                        // Match if: muscle group contains selected keyword OR selected keyword contains first word of muscle group
                        if (muscleName.includes(selectedMuscle.toLowerCase()) ||
                            selectedMuscle.toLowerCase().includes(muscleName.split(' ')[0])) {
                            return selectedMuscle.toLowerCase();
                        }
                    }
                    return null;
                };

                // Check primary muscles first (higher priority)
                for (const muscleGroup of ex.primary_muscle_groups || []) {
                    assignedMuscle = checkMuscleMatch(muscleGroup);
                    if (assignedMuscle) break;
                }

                if (!assignedMuscle || !muscleExercisesMap[assignedMuscle]) {
                    // If Full Body, we might want to store it in a general pool
                    if (isFullBody) {
                        if (!muscleExercisesMap['full body']) muscleExercisesMap['full body'] = { compound: [], isolation: [], core: [], bodyweight: [] };
                        assignedMuscle = 'full body';
                    } else {
                        return;
                    }
                }

                if (category === 'compound') muscleExercisesMap[assignedMuscle].compound.push(ex);
                else if (category === 'core') muscleExercisesMap[assignedMuscle].core.push(ex);
                else if (category === 'bodyweight') muscleExercisesMap[assignedMuscle].bodyweight.push(ex);
                else muscleExercisesMap[assignedMuscle].isolation.push(ex);
            });

            // If muscleKeywords was empty (pure Full Body), we use 'full body' as the only muscle
            let activeMuscles = muscleKeywords.length > 0 ? muscleKeywords : ['full body'];
            const muscleDistribution = dataHelper.calculateMuscleDistribution(activeMuscles, totalExercises);

            const finalExercises = [];
            const usedExerciseIds = new Set();
            const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

            // 6. Select exercises following patterns
            activeMuscles.forEach((muscle, muscleIndex) => {
                const muscleKey = muscle.toLowerCase();
                const muscleData = muscleExercisesMap[muscleKey];
                const exercisesNeeded = muscleDistribution[muscleIndex] || 0;

                if (!muscleData || exercisesNeeded === 0) return;

                const localPattern = dataHelper.getPatternForCount(exercisesNeeded);
                // Shuffle exercises

                const compounds = shuffle([...muscleData.compound]);
                const isolations = shuffle([...muscleData.isolation]);
                const cores = shuffle([...muscleData.core]);
                const bodyweights = shuffle([...muscleData.bodyweight]);

                let compoundIdx = 0;
                let isolationIdx = 0;
                let coreIdx = 0;
                let bodyweightIdx = 0;

                for (const type of localPattern) {
                    let selectedExercise = null;

                    if (filterObj.location === 'No Equipment') {
                        if (bodyweightIdx < bodyweights.length) selectedExercise = bodyweights[bodyweightIdx++];
                        else if (isolationIdx < isolations.length) selectedExercise = isolations[isolationIdx++];
                    } else {
                        if (type === 'C') {
                            if (compoundIdx < compounds.length) selectedExercise = compounds[compoundIdx++];
                            else if (isolationIdx < isolations.length) selectedExercise = isolations[isolationIdx++];
                            else if (coreIdx < cores.length) selectedExercise = cores[coreIdx++];
                        } else { // 'I'
                            if (isolationIdx < isolations.length) selectedExercise = isolations[isolationIdx++];
                            else if (compoundIdx < compounds.length) selectedExercise = compounds[compoundIdx++];
                            else if (coreIdx < cores.length) selectedExercise = cores[coreIdx++];
                        }
                    }

                    if (selectedExercise && !usedExerciseIds.has(selectedExercise._id.toString())) {
                        finalExercises.push(selectedExercise);
                        usedExerciseIds.add(selectedExercise._id.toString());
                    }
                }
            });

            // 7. Fill remaining slots if needed
            if (finalExercises.length < totalExercises) {
                const remaining = totalExercises - finalExercises.length;
                const unused = exercises.filter(ex => !usedExerciseIds.has(ex._id.toString()));
                shuffle(unused).slice(0, remaining).forEach(ex => finalExercises.push(ex));
            }

            console.log("Exercise Selection Completed!");
            return finalExercises.slice(0, totalExercises);

        } catch (error) {
            console.error('Error ExercisesModel@generateExercises:', error);
            return false;
        }
    };


    checkEquipmentExists = (searchTerm, equipmentArray) => {
        const searchWords = searchTerm.toLowerCase().split(/\s+/);

        return equipmentArray.some(item => {
            const itemWords = item.toLowerCase().split(/\s+/);

            // Check if any search word exists in item
            return searchWords.some(searchWord =>
                itemWords.some(itemWord =>
                    itemWord.includes(searchWord) || searchWord.includes(itemWord)
                )
            );
        });
    }

    isEquipmentExistInLocation = (trainingLocation, equipment) => {

        const isSmallGym = trainingLocation == UserModel.trainingLocations.SMALL_GYM;
        const isHomeGym = trainingLocation == UserModel.trainingLocations.HOME_GYM;
        const isFullGym = trainingLocation == UserModel.trainingLocations.FULL_GYM;

        if (isSmallGym) {
            // first check for excluded equipments, if excluded equipment found, return false
            if (this.checkEquipmentExists(equipment, smallGymExcludedEquipments)) {
                return false;
            }
            return this.checkEquipmentExists(equipment, smallGymIncludedEquipments);
        }

        if (isFullGym) {
            return this.checkEquipmentExists(equipment, fullGymIncludedEquipments);
        }

        if (isHomeGym) {
            // first check for excluded equipments, if excluded equipment found, return false
            if (this.checkEquipmentExists(equipment, homeGymExcludedEquipments)) {
                return false;
            }
            return this.checkEquipmentExists(equipment, homeGymIncludedEquipments);
        }

        return false;
    };

    updateOne = async (id, data) => {
        console.log('ExercisesModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let exercise = await Exercises.findByIdAndUpdate(id, data, { new: true })
            if (!exercise) {
                return false;
            }

            return exercise;

        } catch (error) {
            console.log("Error ExercisesModel@updateOne: ", error);
            return false;
        }
    }
}

module.exports = new ExercisesModel;