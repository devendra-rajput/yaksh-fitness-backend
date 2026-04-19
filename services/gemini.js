const fs = require('fs');
const mime = require('mime-types');
// const path = require("path");
const i18n = require('../config/v1/i18n');

// Define your models in order of preference
const MODEL_FALLBACK_LIST = [
    "gemini-flash-latest",      // Alias that points to the newest Flash 
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",   // Most powerful reasoning
    "gemini-2.5-flash"          // Stable 2.5 Flash
];

// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${process.env.GEMINI_API_KEY}`;
// Recommendation: Use 'gemini-3-flash-preview' for the best balance of speed and 2026-era intelligence.
// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GEMINI_API_KEY}`;

class OpenAIService {

    /** Start Menu Scan */
    // Helper function for exponential backoff retries
    // fetchWithBackoff = async (url, options, retries = 2, delay = 1000) => {
    //     for (let i = 0; i < retries; i++) {
    //         try {
    //             const response = await fetch(url, options);
    //             if (response.ok) {
    //                 return response.json();
    //             }

    //             // Don't retry on client errors (4xx), but do on server errors (5xx)
    //             if (response.status >= 400 && response.status < 500) {
    //                 console.error(`Client error: ${response.status}`, await response.text());
    //                 throw new Error(`API request failed with status ${response.status}`);
    //             }

    //             // If server error or rate limit, wait and retry
    //             console.warn(`Attempt ${i + 1}/${retries} failed with status ${response.status}. Retrying in ${delay}ms...`);
    //             await new Promise(resolve => setTimeout(resolve, delay));
    //             delay *= 2; // Exponential backoff
    //         } 
    //         catch (error) {
    //             if (i === retries - 1) 
    //                 throw error; // Re-throw last error

    //             await new Promise(resolve => setTimeout(resolve, delay));
    //             delay *= 2;
    //         }
    //     }
    //     throw new Error("API request failed after all retries.");
    // };

    /** Start Menu Scan */
    analyzeMenuScan = async (imagePath) => {
        try {
            
            // 1. Get data from the request
            const mimeType = mime.lookup(imagePath);
            const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
            const userPrompt = "Analyze the food in this image and provide a detailed nutritional breakdown.";

            // 2. Define the JSON schema for the desired output
            const schema = {
                "type": "OBJECT",
                "properties": {
                    "foodAnalysis": {
                        "description": "An array of detected food items and their nutritional analysis. Null if no food is detected.",
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "food_name": { "type": "STRING", "description": "A short, common name for the food (e.g., 'Grilled Chicken Salad')" },
                                "fiber": { "type": "NUMBER", "description": "Approximate fiber per single serving" },
                                "calories": { "type": "NUMBER", "description": "Approximate calories per single serving" },
                                "protien": { "type": "NUMBER", "description": "Grams of protein" },
                                "fats": { "type": "NUMBER", "description": "Grams of fat" },
                                "carbs": { "type": "NUMBER", "description": "Grams of carbohydrates" },
                                "quality_rating": { "type": "NUMBER", "minimum": 1, "maximum": 100, "description": "1-100 rating of nutritional quality" },
                                "ai_summary": { "type": "STRING", "description": "1-3 sentences summarizing the food's nutritional profile." },
                                "tags": {
                                    "type": "ARRAY",
                                    "items": { "type": "STRING" },
                                    "description": "Relevant tags like 'High Protein', 'Low Carb', etc."
                                },
                                "ingredients": {
                                    "type": "ARRAY",
                                    "items": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "title": { "type": "STRING", "description": "Short common name of the ingredient" },
                                            "description": { "type": "STRING", "description": "Short note about the ingredient" }
                                        },
                                        "required": ["title", "description"]
                                    },
                                    "description": "Array of major visible ingredients."
                                }
                            },
                            "required": ["food_name", "calories", "protien", "fats", "carbs", "quality_rating", "ai_summary", "tags", "ingredients"]
                        }
                    }
                },
                "required": ["foodAnalysis"]
            };

            // 3. Construct the Gemini API payload
            const payload = {
                // System instruction guides the model's behavior
                "systemInstruction": {
                    "parts": [{
                        "text": "You are a helpful menu scanning assistant. Analyze the provided menu image and extract all menu items. Format your response strictly according to the provided JSON schema. If a description is not available for an item, return an empty string for that field."
                    }]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": userPrompt
                            },
                            {
                                "inlineData": {
                                    "mimeType": mimeType,
                                    "data": imageBase64
                                }
                            }
                        ]
                    }
                ],
                // Force JSON output based on the schema
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseSchema": schema
                }
            };
            
            // 4. Call the Gemini API with backoff
            console.log("Sending request to Gemini API...");

            // const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
            // const testData = await testResponse.json();
            // console.log("Available Models:", testData.models.map(m => m.name));

            // Loop through the models
            let responseObj = { 
                status: false, 
                message: i18n.__("error.unableToAnalyzeImage") 
            };

            for (const modelName of MODEL_FALLBACK_LIST) {
                try {
                    console.log(`Attempting analysis with model: ${modelName}`);
                    
                    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;

                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    // If we get a 404, 429 (Rate Limit), or 500 range error, continue to next model
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.warn(`Model ${modelName} failed with status ${response.status}: ${errorText}`);
                        continue; // Move to the next model in the array
                    }

                    const result = await response.json();
                    const candidate = result.candidates?.[0];

                    if (candidate?.content?.parts?.[0]?.text) {
                        const parsedJson = JSON.parse(candidate.content.parts[0].text);
                        
                        if (parsedJson?.foodAnalysis?.length > 0) {
                            console.log(`Success with model: ${modelName}`);
                            responseObj = { status: true, data: parsedJson.foodAnalysis };
                            break;
                        }
                    }

                } catch (error) {
                    console.error(`Error with model ${modelName}:`, error.message);
                    // Continue loop to try next model
                }
            }
            
            // If all models fail
            return responseObj;

        } catch (error) {
            console.error("Error@analyzeMenuScan:", error);

            return { 
                status: false, 
                message: i18n.__("error.unableToAnalyzeImage")
            };
        }
    }
    /** End Menu Scan */

}

module.exports = new OpenAIService();