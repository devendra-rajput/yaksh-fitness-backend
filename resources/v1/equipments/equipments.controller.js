/** Custom Require **/
const dataHelper = require('../../../helpers/v1/data.helpers');
const response = require('../../../helpers/v1/response.helpers');
const EquipmentModel = require('./equipments.model');

class EquipmentController {

    getAll = async (req, res) => {
        console.log('EquipmentController@getAll');

        const result = await EquipmentModel.getAll();
        if (!result?.length) {
            return response.success("success.noRecordsFound", res, result);
        }

        return response.success("success.allEquipments", res, result);
    }

}

module.exports = new EquipmentController;
