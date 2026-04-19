/** Custom Require **/
const Equipments = require('./equipments.schema');

const equipmentDefaultWeights = [
    { equipmentKeyword: "trap bar", weight: 30 },
    { equipmentKeyword: "ez bar", weight: 15 },
    { equipmentKeyword: "smith", weight: 20 },
    { equipmentKeyword: "barbell", weight: 20 },
    { equipmentKeyword: "dumbbell", weight: 10 },
    { equipmentKeyword: "kettlebell", weight: 15 },
    { equipmentKeyword: "plate", weight: 20 },         // plate-loaded variants
    { equipmentKeyword: "selectorized", weight: 20 },
    { equipmentKeyword: "cable", weight: 10 },         // cable > machine
    { equipmentKeyword: "bodyweight", weight: 0 },
    { equipmentKeyword: "machine", weight: 20 }
];

class EquipmentsModel {

    createOne = async (data) => {
        console.log('EquipmentsModel@createOne');

        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            // Insert the Equipments data 
            let result = await Equipments.create(data);
            if (!result) {
                return false;
            }

            return result;
        } catch (error) {
            console.log("Error EquipmentsModel@createOne: ", error);
            return false;
        }
    }

    getOneByColumnNameAndValue = async (columnName, columnValue) => {
        console.log('EquipmentsModel@getOneByColumnNameAndValue');

        try {
            let query = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                },  // Check for null, empty string, or space
            }

            let result = await Equipments.findOne(query).collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;
        } catch (error) {
            console.log("Error EquipmentsModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    getAll = async (filters = {}, projection = null) => {
        console.log('EquipmentsModel@getAll');
        try {
            let dbQuery = {
                deleted_at: {
                    $in: [null, '', ' ']
                }
            };

            // Apply dynamic filters if provided
            if (Object.keys(filters).length > 0) {
                Object.assign(dbQuery, filters);
            }

            let query = Equipments.find(dbQuery).collation({ locale: 'en', strength: 2 });

            // Apply projection if given
            if (projection) {
                query = query.select(projection);
            }

            const results = await query.lean();
            if (!results) {
                return false;
            }

            return results;
        } catch (error) {
            console.log("Error EquipmentsModel@getAll: ", error);
            return false;
        }
    }

    getEquipmentDefaultWeight(title = "") {
        console.log('EquipmentsModel@getEquipmentDefaultWeight');

        const t = title.toLowerCase();
        for (const rule of equipmentDefaultWeights) {
            if (t.includes(rule.equipmentKeyword)) {
                return rule.weight;
            }
        }
        return 0;   // <= no match defaults to 0 lbs
    }

}

module.exports = new EquipmentsModel;

