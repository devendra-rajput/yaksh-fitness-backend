/** Custom Require **/ 
const Goal = require('./goal.schema');
const dataHelper = require('../../../helpers/v1/data.helpers');

class GoalModel {

    constructor() {
        // 
    }

    createOne = async (data) => {
        console.log('GoalModel@createOne');

        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            // Insert the goal data 
            let goal = await Goal.create(data);
            if (!goal) {
                return false;
            }

            return goal;

        } catch (error) {
            console.log("Error GoalModel@createOne: ", error);
            return false;
        }
            
    }

    getOneByColumnNameAndValue = async (columnName, columnValue) => {
        console.log('GoalModel@getOneByColumnNameAndValue');

        try {
            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            let result = await Goal.findOne(dbQuery)
                                    .collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error GoalModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    isGoalExist = async (columnName, columnValue, goalId = false) => {
        console.log('GoalModel@isGoalExist');

        try {
            let query = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            }

            if (goalId) {
                query = {
                    ...query,
                    _id: {
                        $ne: goalId
                    }
                }
            }

            let goalsCount = await Goal.countDocuments(query).collation({ locale: 'en', strength: 2 });
            if (!goalsCount || goalsCount <= 0) {
                return false;
            }

            return true;

        } catch (error) {
            console.log("Error GoalModel@isGoalExist: ", error);
            return false;
        }
    }

    updateOne = async (id, data) => {
        console.log('GoalModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let goal = await Goal.findByIdAndUpdate(id, data, { new: true })
            if (!goal) {
                return false;
            }

            return goal;

        } catch (error) {
            console.log("Error GoalModel@updateOne: ", error);
            return false;
        }
    }

    deleteOne = async (id) => {
        console.log("GoalModel@deleteOne");

        try {
            let result = await Goal.deleteOne({ _id: id })
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error GoalModel@deleteOne: ", error);
            return false;
        }
    }

    getAll = async (filterObj = {}) => {
        console.log('UsersResources@getAll');

        try {
            let results;
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            };

            let goals = await Goal.aggregate([
                                                { $match: dbQuery},
                                                {
                                                    $project: {
                                                        password: 0,
                                                        auth_token: 0,
                                                        fcm_token: 0
                                                    }
                                                }
                                            ])
                                            .sort({ title: 1});
            
            if (!goals) {
                results = [];
            }
            else {
                results = goals;
            }

            return results;

        } catch (error) {
            console.log("Error GoalModel@getAll: ", error);
            return [];
        }
            
    }
}

module.exports =  new GoalModel;
