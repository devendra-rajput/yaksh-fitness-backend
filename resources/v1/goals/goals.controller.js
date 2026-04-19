/** Custom Require **/ 
const response = require('../../../helpers/v1/response.helpers');
const GoalModel = require('./goals.model');

class GoalController {

    getAll = async (req, res) => {
        console.log('GoalsController@getAll');

        const result = await GoalModel.getAll();
        if(!result?.length){
            return response.success("success.noRecordsFound", res, result);
        }

        return response.success("success.goalsData", res, result);
    }
}

module.exports = new GoalController;
