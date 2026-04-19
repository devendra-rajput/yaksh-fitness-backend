/** Custom Require **/ 
const response = require('../../../helpers/v1/response.helpers');
const SettingModel = require('./settings.model');

class SettingController {

    getCurrentSetting = async (req, res) => {
        console.log('SettingController@getCurrentSetting');

        const result = await SettingModel.getCurrentSetting();
        if(!result?.length){
            return response.success("success.noRecordsFound", res, result);
        }

        return response.success("success.settingData", res, result);
    }
}

module.exports = new SettingController;
