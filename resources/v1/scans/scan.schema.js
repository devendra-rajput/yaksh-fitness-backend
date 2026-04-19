const mongoose = require('mongoose');
Schema = mongoose.Schema

const BodyMetricsSchema = new mongoose.Schema({
                            shoulder_tilt_raw: { type: Number, default: '' },
                            hip_tilt_raw: { type: Number, default: '' },
                            head_tilt_angle: { type: Number, default: '' }, // In degree
                            shoulder_tilt_perc: { type: Number, default: '' },
                            hip_tilt_perc: { type: Number, default: '' },
                            arm_symmetry_perc: { type: Number, default: '' }
                        }, { _id: false });

const BodyReportSchema = new mongoose.Schema({
                            body_composition: { type: Object, default: {} },
                            symmetry_analysis: { type: Object, default: {} },
                            posture_assessment: { type: Object, default: {} },
                            muscle_development: { type: Object, default: {} },
                            health_indicators: { type: Object, default: {} },
                            overall_score: { type: String, default: '' },
                            overall_score_title: { type: String, default: '' }
                        }, { _id: false });

// const FoodReportSchema = new mongoose.Schema({
//     food_name: { type: String, default: '' },
//     calories: { type: Number, default: 0 },
//     protien: { type: Number, default: 0 },
//     fats: { type: Number, default: 0 },
//     carbs: { type: Number, default: 0 },
//     quality_rating: { type: Number, default: 0 },
//     quality_rating_title: { type: String, default: '' },
//     tags: [{type: String, default: ''}]
// }, { _id: false });

const MenuReportItemSchema = new mongoose.Schema({
                                food_name: { type: String, default: '' },
                                fiber: { type: Number, default: 0 },
                                calories: { type: Number, default: 0 },
                                protein: { type: Number, default: 0 }, // corrected spelling from "protien"
                                fats: { type: Number, default: 0 },
                                carbs: { type: Number, default: 0 },
                                quality_rating: { type: Number, default: 0 },
                                ai_summary: { type: String, default: '' },
                                tags: [{type: String, default: ''}],
                                ingredients: [{ 
                                    title: { type: String, default: '' },
                                    description: { type: String, default: '' }
                                }]
                            }, { _id: false });

const NutritionSchema = new mongoose.Schema({
                            fiber: { type: Number, default: '' },
                            fat: { type: Number, default: '' },
                            carbs: { type: Number, default: '' },
                            protein: { type: Number, default: '' },
                            calories: { type: Number, default: '' },
                            weight_qty: { type: Number, default: '' }, // Like as 20 grm fiber
                            weight_unit: { type: String, default: '' },
                            serving_qty: { type: Number, default: '' }, // Like as 2 slice or cup
                            serving_unit: { type: String, default: '' }
                        }, { _id: false });

const FoodsSchema = new mongoose.Schema({
                        recognised_food_name: { type: String, default: '' },
                        food_name: { type: String, default: '' },
                        food_type: { type: String, default: '' },
                        nutrition: { type: NutritionSchema, default: {} },
                        score: { type: Number, default: '' },
                        brand_name: { type: String, default: '' },
                        tags: { type: [], default: '' },
                        weight_grams: { type: Number, default: '' },
                        portion_size: { type: String, default: '' }, // Like piece or cup
                        meal_time: { type: String, default: '' }, // Lunch, Dinner, Breakfast
                        consumed_qty: { type: Number, default: 1 },
                    });

const ScansSchema = new mongoose.Schema({
    user_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user', 
        default: null 
    },
    type: { type: String, enum: ['food', 'body', 'menu'], default: 'body' },
    age: { type: Number, default: '' },
    height: { type: String, default: '' },
    height_unit: { type: String, default: 'cm' },
    weight: { type: String, default: '' },
    weight_unit: { type: String, default: 'Lbs' },
    image_url: { type: String, default: '' },
    model_url: { type: String, default: '' },
    model_type: { type: String, default: '' },
    body_metrics: { type: BodyMetricsSchema, default: {} },
    body_report: { type: BodyReportSchema, default: {} },
    foods: { type: [FoodsSchema], default: [] },
    // food_report: { type: FoodReportSchema, default: {} },
    // food_ingredients: [{ 
    //     title: { type: String, default: '' },
    //     description: { type: String, default: '' },
    //     image: { type: String, default: '' } 
    // }],
    // food_substitutions: [{ 
    //     title: { type: String, default: '' },
    //     description: { type: String, default: '' },
    //     image: { type: String, default: '' } 
    // }],
    ai_summary: { type: String, default: '' },
    menu_report: [ MenuReportItemSchema ],
    deleted_at: { type: String, default: '' }
}, { 
    timestamps: { 
        createdAt: 'created_at', 
        updatedAt: 'updated_at' 
    } 
})

const Scans = mongoose.model("scans", ScansSchema, 'scans');

module.exports = Scans;