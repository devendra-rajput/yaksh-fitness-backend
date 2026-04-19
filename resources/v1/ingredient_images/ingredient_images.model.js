/** Custom Require **/ 
const IngredientImage = require('./ingredient_image.schema');

class IngredientImageModel {

    constructor() {
        // 
    }

    createOne = async (data) => {
        console.log('IngredientImageModel@createOne');

        try {
            if (!data || data === '') {
                throw new Error('Data is required');
            }

            let ingredientImage = await IngredientImage.create(data);
            if (!ingredientImage) {
                return false;
            }

            return ingredientImage;

        } catch (error) {
            console.log("Error IngredientImageModel@createOne: ", error);
            return false;
        }
            
    }

    createBulk = async (dataArr) => {
        console.log('IngredientImageModel@createBulk');

        try{

            if (!dataArr || dataArr === '') {
                return false
            }

            let ingredientImages = await IngredientImage.insertMany(dataArr);
            if (!ingredientImages || ingredientImages.length === 0) {
                return false;
            }

            return ingredientImages;

        } catch (error) {
            console.log("Error IngredientImageModel@createBulk: ", error);
            return false;
        }
    }

    getOneByColumnNameAndValue = async (columnName, columnValue) => {
        console.log('IngredientImageModel@getOneByColumnNameAndValue');

        try {
            let dbQuery = {
                [columnName]: columnValue,
                deleted_at: {
                    $in: [null, '', ' ']
                } // Check for null, empty string, or space
            }

            let result = await IngredientImage.findOne(dbQuery)
                                                    .collation({ locale: 'en', strength: 2 });
            if (!result) {
                return false;
            }

            return result;

        } catch (error) {
            console.log("Error IngredientImageModel@getOneByColumnNameAndValue: ", error);
            return false;
        }
    }

    updateOne = async (id, data) => {
        console.log('IngredientImageModel@updateOne');

        try {
            if ((!id || id === '') || (!data || data === '')) {
                throw new Error('data is required');
            }

            let ingredientImage = await IngredientImage.findByIdAndUpdate(id, data, { new: true })
            if (!ingredientImage) {
                return false;
            }

            return ingredientImage;

        } catch (error) {
            console.log("Error IngredientImageModel@updateOne: ", error);
            return false;
        }
    }

    deleteOne = async (id) => {
        console.log("IngredientImageModel@deleteOne");

        try {
            let result = await IngredientImage.deleteOne({ _id: id })
            if (!result) {
                return false
            }

            return result

        } catch (error) {
            console.log("Error IngredientImageModel@deleteOne: ", error);
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

            if(filterObj?.titles_arr?.length){
                dbQuery.title = {
                    $in: filterObj.titles_arr
                }
            }

            let ingredientImages = await IngredientImage.aggregate([
                                                { $match: dbQuery}
                                            ])
                                            .sort({ title: 1});
            
            if (!ingredientImages) {
                results = [];
            }
            else {
                results = ingredientImages;
            }

            return results;

        } catch (error) {
            console.log("Error IngredientImageModel@getAll: ", error);
            return [];
        }
            
    }
}

module.exports =  new IngredientImageModel;
