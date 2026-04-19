const mongoose = require('mongoose');

const IngredientImagesSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    image: { type: String, default: '' },
    deleted_at: { type: String, default: '' }
}, { 
    timestamps: { 
        createdAt: 'created_at', 
        updatedAt: 'updated_at' 
    } 
})

const IngredientImages = mongoose.model("ingredient_images", IngredientImagesSchema, 'ingredient_images');

module.exports = IngredientImages;