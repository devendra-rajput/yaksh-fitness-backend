/** Custom Require **/
const MuscleGroups = require('./muscle_groups.schema');

class MuscleGroupsModel {

    createOne = async (data) => {
        console.log('MuscleGroupsModel@createOne');
        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            // Insert the language data 
            let result = await MuscleGroups.create(data);
            if (!result) {
                return false;
            }
            return result;
        } catch (error) {
            console.log("Error MuscleGroupsModel@createOne: ", error);
            return false;
        }
    }

    getOneByColumnNameAndValue = async (columnName, columnValue) => {
        console.log('MuscleGroupsModel@getOneByColumnNameAndValue');

        try {
            let query = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            }

            let result = await MuscleGroups.findOne(query).collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;
        } catch (error) {
            console.log("Error MuscleGroupsModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    findByMuscleKeywords = async (filterObj) => {
        console.log('MuscleGroupsModel@findByMuscleKeywords');

        try {
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            }

            if (!filterObj.muscles || !filterObj.muscles.trim()) {
                return [];
            }

            const musclesArray = filterObj?.muscles.split(',').map(t => t.trim()).filter(Boolean);

            const regexArray = musclesArray.map(t => {
                const safe = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // match keyword BEFORE '(' (parenthisis)
                return new RegExp(`^([^()]*)${safe}`, 'i');
            });

            dbQuery = {
                ...dbQuery,
                title: { $in: regexArray },
            };

            let results = await MuscleGroups.find(dbQuery).collation({ locale: 'en', strength: 2 });
            if (!results.length) {
                return [];
            }

            return results;
        } catch (error) {
            console.log('Error MuscleGroupsModel@findByMuscleKeywords:', error);
            return [];
        }
    };

}

module.exports = new MuscleGroupsModel;
