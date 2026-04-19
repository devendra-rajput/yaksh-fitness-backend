const i18n = require('../config/v1/i18n');
// const axios = require("axios");

class SpoonacularService {

    constructor() {
        this.apiKey = process.env.SPOONACULAR_API_KEY ?? "74dc0ffb5ab74bdc980b7605ced96287";
        this.baseUrl = process.env.SPOONACULAR_API_URL ?? "https://api.spoonacular.com";
    }

    fetchMealsForToday = (type, mealSettings) => {
        console.log("SpoonacularService@fetchMealsForToday", type)
        // const url = `${this.baseUrl}/recipes/complexSearch?type=${encodeURIComponent(type)}&number=2&apiKey=${this.apiKey}`;

        const queryParams = new URLSearchParams({
            type: encodeURIComponent(type),
            addRecipeNutrition: true,
            addRecipeInformation: true,
            fillIngredients: true,
            number: '5',
            apiKey: this.apiKey
        });

        if(mealSettings?.diet_style){
            queryParams.append('diet', mealSettings.diet_style);
        }

        if (mealSettings.calories) queryParams.append('maxCalories', mealSettings.calories);
        if (mealSettings.protein){
            const protein = Number(mealSettings.protein) > 90 ? 90 : mealSettings.protein; // API accept maximum 90
            queryParams.append('maxProtein', protein);   
        }
        if (mealSettings.carbs) {
            const carbs = Number(mealSettings.carbs) > 100 ? 100 : mealSettings.carbs; // API accept maximum 100
            queryParams.append('maxCarbs', carbs);
        }
        if (mealSettings.fats){
            const fats = Number(mealSettings.fats) > 90 ? 90 : mealSettings.fats; // API accept maximum 90
            queryParams.append('maxFat', fats);
        }

        const intolerances = [];
        if (mealSettings.exclude_gluten) intolerances.push('Gluten');
        if (mealSettings.exclude_dairy) intolerances.push('Dairy');
        if (mealSettings.exclude_nuts) intolerances.push('Tree Nut');
        if (mealSettings.exclude_soy) intolerances.push('Soy');
        if (mealSettings.exclude_shellfish) intolerances.push('Shellfish');
        if (mealSettings.exclude_eggs) intolerances.push('Egg');

        if (intolerances.length > 0) {
            queryParams.append('intolerances', intolerances.join(','));
        }
        
        if (mealSettings.dislike_foods.length > 0) {
            queryParams.append('excludeIngredients', mealSettings.dislike_foods.join(','));
        }

        if (mealSettings.cuisines.length > 0) {
            queryParams.append('cuisine', mealSettings.cuisines.join(','));
        }

        // console.log(queryParams, "========queryParams");

        let url = `${this.baseUrl}/recipes/complexSearch?${queryParams.toString()}`;
        
        // return axios.get(url)
        //             .then(res => res.data)
        //             .catch(error => {
        //                 console.error('Axios error:', error);
        //                 // throw error; // Optional: rethrow if needed
        //             });
        // return fetch(url).then(res => res.json());

        try {
            return fetch(url).then(res => res.json())
        } catch (error) {
            console.log(error, '=========error');
            return { results: [] }
        }
    };

    getMealsForToday = async (mealSettings) => {
        console.log("SpoonacularService@getMealsForToday")

        try {
            const [breakfast, lunch, dinner] = await Promise.all([
                this.fetchMealsForToday('breakfast', mealSettings),
                this.fetchMealsForToday('main course', mealSettings),
                this.fetchMealsForToday('side dish', mealSettings)
            ]);

            // console.log(lunch, "=======lunch");

            return {
                status: true,
                data: {
                    breakfast: breakfast.results,
                    lunch: lunch.results,
                    dinner: dinner.results
                }
            }

        } catch (error) {
            console.error('Error fetching meals:', error);

            return {
                status: false,
                message: i18n.__("error.failedToFetchMeals")
            }
        }
    }

    /** Get meals to display pn library page */
    getMeals = async (page, limit, filterObj) => {
        console.log("SpoonacularService@getMeals")

        const queryParams = new URLSearchParams({
            // type: encodeURIComponent(type),
            number: limit ?? 10,
            offset: limit && page ? limit * (page - 1) : 0,
            addRecipeNutrition: true,
            // addRecipeInformation: true,
            // fillIngredients: true,
            apiKey: this.apiKey
        });

        if(filterObj?.diet){
            queryParams.append('diet', filterObj.diet);
        }

        if(filterObj?.meal_type){
            queryParams.append('type', filterObj.meal_type);
        }

        if(filterObj?.ingredients){
            queryParams.append('includeIngredients', filterObj.ingredients);
        }

        if(filterObj?.cuisine){
            queryParams.append('cuisine', filterObj.cuisine);
        }

        if(filterObj?.search){
            queryParams.append('query', filterObj.search);
        }

        console.log(queryParams, '==========queryParams');

        let url = `${this.baseUrl}/recipes/complexSearch?${queryParams.toString()}`;
        
        try {

            const response = await fetch(url)
                                .then(res => res.json())
                                .catch((err) => {
                                    console.log("Error ========>", err);
                                    return false;
                                });

            if(!response?.results){
                return {
                    status: false,
                    message: i18n.__("error.failedToFetchMeals")
                }
            }

            return {
                status: true,
                data: response
            }

        } catch (error) {
            console.log(error, '=========error');
            return {
                status: false,
                message: i18n.__("error.failedToFetchMeals")
            }
        }
    };

    /** Get meal details */
    getMealDetail = async (mealId) => {
        console.log("SpoonacularService@getMealDetail")

        const queryParams = new URLSearchParams({
            apiKey: this.apiKey,
            includeNutrition: true
        });

        let url = `${this.baseUrl}/recipes/${mealId}/information?${queryParams.toString()}`;
        
        try {

            const response = await fetch(url)
                                .then(res => res.json())
                                .catch((err) => {
                                    console.log("Error ========>", err);
                                    return false;
                                });
            
            if(!response?.id){
                return {
                    status: false,
                    message: i18n.__("error.failedToFetchMealDetail")
                }
            }

            return {
                status: true,
                data: response
            }

        } catch (error) {
            console.log(error, '=========error');
            return {
                status: false,
                message: i18n.__("error.failedToFetchMealDetail")
            }
        }
    };
}

module.exports = new SpoonacularService;