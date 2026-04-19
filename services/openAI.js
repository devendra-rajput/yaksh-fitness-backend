const fs = require('fs');
const path = require("path");
const tf = require("@tensorflow/tfjs");
const poseDetection = require("@tensorflow-models/pose-detection");
// const tesseract = require('tesseract.js');
const { exec } = require('child_process');
const { createCanvas, loadImage } = require('canvas');
const { OpenAI } = require('openai');

const dataHelper = require('../helpers/v1/data.helpers');
const i18n = require('../config/v1/i18n');
const ScanModel = require('../resources/v1/scans/scans.model');

// const METRIC_TOLERANCES = {
//     shoulder_tilt_raw: 2,   // degrees
//     hip_tilt_raw: 2,
//     head_tilt_angle: 2,     // degrees
//     shoulder_tilt_perc: 2,  // percent
//     hip_tilt_perc: 2,
//     arm_symmetry_perc: 2
// };

class OpenAIService {

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // this.metricTolerances = METRIC_TOLERANCES;
    }


    /** Start Body Scan */
    validateFullBody = async (keypoints) => {
        console.log("OpenAIService@validateFullBody")

        const REQUIRED_KEYPOINTS = [
            "nose",
            "left_shoulder", "right_shoulder",
            "left_hip", "right_hip",
            "left_knee", "right_knee",
            "left_ankle", "right_ankle"
        ];

        const MIN_SCORE = 0.5; // adjust threshold

        // console.log(keypoints, '=========keypoints');

        let isValidBodyImage = true;
        for (const name of REQUIRED_KEYPOINTS) {
            const kp = await keypoints.find(k => k.name === name);
            if (!kp || kp.score == null || kp.score < MIN_SCORE) {
                isValidBodyImage = false; // missing or low confidence
                break;
            }
        }

        // console.log(isValidBodyImage, "=======isValidBodyImage");
        return isValidBodyImage;
    };

    validateFrontOrBack = async (keypoints) => {
        const shoulders = ["left_shoulder", "right_shoulder"];
        const hips = ["left_hip", "right_hip"];

        return shoulders.every(n => keypoints.find(k => k.name === n)?.score > 0.4) &&
                hips.every(n => keypoints.find(k => k.name === n)?.score > 0.4);
    };

    // ---------- Image Loader ----------
    loadImageAsTensor = async (imagePath) => {
        const img = await loadImage(imagePath);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);

        // Node.js requires tf.node.fromPixels(), not tf.browser.fromPixels()
        const input = tf.browser.fromPixels(canvas);
        return { input, width: img.width, height: img.height, canvas };
    }

    // ---------- Pose Detection ----------
    getPoseLandmarks = async (imagePath) => {
        const detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.BlazePose,
            { 
                runtime: "tfjs", 
                modelType: "full" 
            }
        );

        const { input, width, height } = await this.loadImageAsTensor(imagePath);
        const poses = await detector.estimatePoses(input, { flipHorizontal: false });
        input.dispose();

        if (!poses || !poses.length) 
            return null;

        return { 
            keypoints: poses[0].keypoints, 
            imageWidth: width, 
            imageHeight: height 
        };
    }

    // ---------- Helper Functions ----------
    findKeypoint = (kps, name) => {
        return kps.find((k) => k.name === name) || null;
    }

    calculateTilt = (p1, p2) => {
        if (!p1 || !p2 || p1.x == null || p1.y == null || p2.x == null || p2.y == null) {
            return null;
        }
        return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
    }

    formatAngle = (angle) => {
        return angle == null ? "N/A" : `${angle.toFixed(2)}°`;
    }

    formatPerc = (value) => {
        return value == null ? "N/A" : `${value.toFixed(2)}%`;
    }

    // ---------- Metrics Calculation ----------
    calculateMetrics = (keypoints) => {
        const leftShoulder = this.findKeypoint(keypoints, "left_shoulder");
        const rightShoulder = this.findKeypoint(keypoints, "right_shoulder");
        const leftHip = this.findKeypoint(keypoints, "left_hip");
        const rightHip = this.findKeypoint(keypoints, "right_hip");
        const leftEye = this.findKeypoint(keypoints, "left_eye");
        const rightEye = this.findKeypoint(keypoints, "right_eye");
        const leftWrist = this.findKeypoint(keypoints, "left_wrist");
        const rightWrist = this.findKeypoint(keypoints, "right_wrist");
        const leftElbow = this.findKeypoint(keypoints, "left_elbow");
        const rightElbow = this.findKeypoint(keypoints, "right_elbow");

        // Safe tilt calculations
        const shoulderTiltRaw = this.calculateTilt(leftShoulder, rightShoulder);
        const hipTiltRaw = this.calculateTilt(leftHip, rightHip);
        const headTiltRaw = this.calculateTilt(leftEye, rightEye);

        // Arm symmetry
        let armSymmetry = null;
        if (leftWrist && rightWrist && leftElbow && rightElbow) {
            if ([leftWrist.y, rightWrist.y, leftElbow.y, rightElbow.y].every(v => v != null)) {
                const wristDiff = Math.abs(leftWrist.y - rightWrist.y);
                const elbowDiff = Math.abs(leftElbow.y - rightElbow.y);
                armSymmetry = (wristDiff + elbowDiff) / 2;
            }
        }

        // Image height for normalization
        const allYs = keypoints.map(k => k.y).filter(v => v != null);
        const imageH = allYs.length ? Math.max(...allYs) : null;
        const normalize = (val) => (val != null && imageH ? (val / imageH) * 100 : null);

        return {
            shoulder_tilt_raw: shoulderTiltRaw,
            hip_tilt_raw: hipTiltRaw,
            head_tilt_angle: this.formatAngle(headTiltRaw),
            shoulder_tilt_perc: this.formatPerc(normalize(Math.abs(shoulderTiltRaw))),
            hip_tilt_perc: this.formatPerc(normalize(Math.abs(hipTiltRaw))),
            arm_symmetry_perc: this.formatPerc(normalize(armSymmetry))
        };
    }

    // ---------- GPT-4o Analysis ----------
    /** Noraml Scanning */
    getFullBodyReport = async (imagePath, metrics, personInfo, previousBodyReport = false) => {
        const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
        const { age, height, weight, gender } = personInfo;

        // const prompt = `
        //     You are a professional fitness coach and physiotherapist.

        //     Person's Data:
        //         - Age: ${age}
        //         - Weight: ${weight} kg

        //     Extracted Posture Metrics:
        //         - Shoulder tilt: ${metrics.shoulderTiltPerc}
        //         - Hip tilt: ${metrics.hipTiltPerc}
        //         - Head tilt angle: ${metrics.headTiltAngle}

        //     From this, estimate and return a JSON object with:
        //         1. Estimated Body Fat Percentage (e.g. 18-22%)
        //         2. Body Composition
        //             - Body Fat (In Percentage)
        //             - Category
        //             - Classification (In Percentage)
        //         3. Symmetry Analysis
        //             - Left vs Right Muscle Development Score (1-10)
        //         4. Posture Assessment
        //             - Head alignment score (1-10)
        //             - Shoulder alignment score (1-10)
        //             - Hip alignment score (1-10)
        //         5. Muscle Development
        //             - Lagging muscle groups (e.g. shoulders, arms, legs)
        //             - Strength score (1-10)
        //         6. Health Indicators
        //             - Visible signs of bloating (Yes/No)
        //             - Water retention level (Low / Medium / High)

        //     Only return valid JSON.
        // `;

        const previousDataSection = previousBodyReport 
                                    ? `Previous Scan Data (for comparison):\n${JSON.stringify(previousBodyReport)}`
                                    : `No previous scan data is available. Generate the ai_summary based only on the current scan.`;

        const prompt = `
            You are a professional fitness coach and physiotherapist.

            Person's Data:
                - Age: ${age}
                - Height: ${height} cm
                - Weight: ${weight} kg
                - Gender: ${gender}

            Extracted Posture Metrics:
                - Shoulder tilt: ${metrics.shoulder_tilt_raw}
                - Hip tilt: ${metrics.hip_tilt_raw}
                - Head tilt angle: ${metrics.head_tilt_angle}

            ${previousDataSection}

            From this, estimate and return a JSON object with:
                1. body_composition:
                    {
                        "bmi": number (10-50),
                        "body_type": (Ectomorph / Mesomorph / Endomorph),
                        "body_age": number (1-100),
                        "lean_mass": number (%),
                        "body_fat": number (%),
                        "category": (Lean / Average / Overweight),
                        "classification": number (%)
                    }
                2. symmetry_analysis:
                    {
                        "left_muscle_score": number (1-10),
                        "right_muscle_score": number (1-10),
                        "overall_score": number (1-10)
                    }
                3. posture_assessment:
                    {
                        "head_alignment_score": number (1-100),
                        "shoulder_alignment_score": number (1-100),
                        "hip_alignment_score": number (1-100)
                    }
                4. muscle_development:
                    {
                        "lagging_muscle_groups": [list of strings],
                        "strength_score": number (1-10),
                        "muscle_weight": number(in kgs)
                    }
                5. health_indicators:
                    {
                        "visible_signs_of_bloating": "Yes" or "No",
                        "water_retention_level": "Low" | "Medium" | "High"
                    }
                6. overall_score: number (0-100)
                7. ai_summary: string 
                                → A very short summary (maximum 2-3 sentences). 
                                If previous scan data exists, highlight key improvements or changes. 
                                If no previous scan data exists, provide an initial assessment. 
                                Keep the tone positive and concise.

            Only return **valid JSON** with exactly the above structure.
        `;

        const callOpenAI = async () => {
            const response = await this.openai.chat.completions.create({
                model: "gpt-5-mini", // <- switched from gpt-4o to gpt-5-mini
                messages: [
                    {
                        role: "system",
                        content: "You are a precise, structured JSON-only fitness analysis assistant."
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
                            }
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                // temperature: 0.25,
                max_completion_tokens: 1500 // <-- Correct param name for GPT-5-mini
            });

            // console.log(JSON.stringify(response), "========Open AI Response");
            return response?.choices[0]?.message?.content || null;
        }
        
        let openAIResponse = await callOpenAI();
        let apiCallCount = 1;
        while (apiCallCount < 5 && !openAIResponse) {
            console.log('OpenAI API call failed. Retrying...');
            openAIResponse = await callOpenAI();
            apiCallCount++;
        }

        return openAIResponse;
    }

    /** Switch Model */
    // getFullBodyReport = async (imagePath, metrics, personInfo, previousBodyReport = false) => {
    //     const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });
    //     const { age, height, weight, gender } = personInfo;

    //     const previousDataSection = previousBodyReport 
    //                                 ? `Previous Scan Data (for comparison):\n${JSON.stringify(previousBodyReport)}`
    //                                 : `No previous scan data is available. Generate the ai_summary based only on the current scan.`;

    //     const prompt = `
    //         You are a professional fitness coach and physiotherapist.

    //         Person's Data:
    //             - Age: ${age}
    //             - Height: ${height} cm
    //             - Weight: ${weight} kg
    //             - Gender: ${gender}

    //         Extracted Posture Metrics:
    //             - Shoulder tilt: ${metrics.shoulder_tilt_raw}
    //             - Hip tilt: ${metrics.hip_tilt_raw}
    //             - Head tilt angle: ${metrics.head_tilt_angle}

    //         ${previousDataSection}

    //         From this, estimate and return a JSON object with:
    //             1. body_composition:
    //                 {
    //                     "bmi": number (10-50),
    //                     "body_type": (Ectomorph / Mesomorph / Endomorph),
    //                     "body_age": number (1-100),
    //                     "lean_mass": number (%),
    //                     "body_fat": number (%),
    //                     "category": (Lean / Average / Overweight),
    //                     "classification": number (%)
    //                 }
    //             2. symmetry_analysis:
    //                 {
    //                     "left_muscle_score": number (1-10),
    //                     "right_muscle_score": number (1-10),
    //                     "overall_score": number (1-10)
    //                 }
    //             3. posture_assessment:
    //                 {
    //                     "head_alignment_score": number (1-100),
    //                     "shoulder_alignment_score": number (1-100),
    //                     "hip_alignment_score": number (1-100)
    //                 }
    //             4. muscle_development:
    //                 {
    //                     "lagging_muscle_groups": [list of strings],
    //                     "strength_score": number (1-10),
    //                     "muscle_weight": number(in kgs)
    //                 }
    //             5. health_indicators:
    //                 {
    //                     "visible_signs_of_bloating": "Yes" or "No",
    //                     "water_retention_level": "Low" | "Medium" | "High"
    //                 }
    //             6. overall_score: number (0-100)
    //             7. ai_summary: string 
    //                             → A very short summary (maximum 2-3 sentences). 
    //                             If previous scan data exists, highlight key improvements or changes. 
    //                             If no previous scan data exists, provide an initial assessment. 
    //                             Keep the tone positive and concise.

    //         Only return **valid JSON** with exactly the above structure.
    //     `;

    //     const callOpenAI = async ({ model, withImage }) => {
    //         const messages = [
    //         {
    //             role: "system",
    //             content: "You are a strict JSON-only fitness analysis assistant."
    //         },
    //         {
    //             role: "user",
    //             content: withImage
    //             ? [
    //                 { type: "text", text: prompt },
    //                 {
    //                     type: "image_url",
    //                     image_url: {
    //                     url: `data:image/jpeg;base64,${imageBase64}`
    //                     }
    //                 }
    //                 ]
    //             : [{ type: "text", text: prompt }]
    //         }
    //         ];

    //         const response = await this.openai.chat.completions.create({
    //             model,
    //             messages,
    //             response_format: { type: "json_object" },
    //             temperature: 0.25,
    //             max_completion_tokens: 1200
    //         });

    //         return response.choices[0].message.content;
    //     };

    //     // 1️⃣ Primary: gpt-5-mini with image
    //     try {
    //         const openAIResponse = await callOpenAI({ model: "gpt-5-mini", withImage: true });
    //         if(openAIResponse){
    //             return openAIResponse;
    //         }
    //     } catch (err) {
    //         console.warn("Vision failed on gpt-5-mini, retrying without image...");
    //     }

    //     // // 2️⃣ Fallback: gpt-5-mini without image
    //     // try {
    //     //     return await callOpenAI({ model: "gpt-5-mini", withImage: false });
    //     // } catch (err) {
    //     //     console.warn("gpt-5-mini text-only failed, falling back to gpt-4o...");
    //     // }

    //     // 3️⃣ Final fallback: gpt-4o with image (most reliable)
    //     try {
    //         return await callOpenAI({ model: "gpt-4o", withImage: true });
    //     } catch (err) {
    //         console.error("All AI attempts failed");
    //         // throw new Error("Unable to generate body report");
    //         return false;
    //     }
    // }

    parseMetric = (val) => {
        if (val == null) return null;
        if (typeof val === "number") return val;
        return parseFloat(val.replace(/[^\d.-]/g, "")); // remove % or °
    };

    // ---------- Main Analysis ----------
    analyzeBodyScan = async (imagePath, personInfo, previousBodyReport = false) => {
        try {
            console.log("1) Detecting pose landmarks...");
            const poseResult = await this.getPoseLandmarks(imagePath);
            // console.log(poseResult, '==========poseResult');
            if (!poseResult) {
                return { 
                    status: false, 
                    message: i18n.__("error.noPoseDetected")
                };
            }
            // console.log("Detected keypoints:", poseResult.keypoints.length);

            // Validate the full body image
            const isValidBodyImage = await this.validateFullBody(poseResult.keypoints);
            console.log(isValidBodyImage, '==========isValidBodyImage');
            if (!isValidBodyImage) {
                return { 
                    status: false, 
                    message: i18n.__("error.noMetricsDetected") 
                };
            }

            // // Validate only front and back image
            // if (!this.validateFrontOrBack(poseResult.keypoints)) {
            //     return { 
            //         status: false, 
            //         message: i18n.__("error.frontOrBackImageError")
            //     };
            // }

            console.log("2) Calculating metrics...");
            const metrics = this.calculateMetrics(poseResult.keypoints);
            console.log(metrics, '==========metrics');
            if (!metrics) {
                return { 
                    status: false,
                    message: i18n.__("error.noMetricsDetected")
                };
            }
            // console.log("Metrics:", metrics);

            let parsedMetrics = {};
            for(const key in metrics){
                parsedMetrics[key] = this.parseMetric(metrics[key]);
            }

            console.log("3) Check the metrics in DB...");
            let report;
            // const scanObj = await ScanModel.getOneByBodyMetrics(personInfo.user_id, parsedMetrics);
            // if(scanObj?.body_report){
            //     report = scanObj?.body_report;

            //     return { 
            //         status: true,
            //         is_cache: true,
            //         data: scanObj
            //     };
            // }

            console.log("4) Sending metrics + image to GPT-4o...");
            report = await this.getFullBodyReport(imagePath, metrics, personInfo, previousBodyReport);
            // console.log(report, '==========report');

            try {
                report = JSON.parse(report);
            } catch (err) {
                console.error("Invalid JSON from OpenAI:", content);
                return { 
                    status: false,
                    message: i18n.__("error.invalidDataReturnedByAI"),
                    data: report
                };
            }

            // const isValidJson = await dataHelper.isValidJSON(report);
            // if(!isValidJson){
            //     return { 
            //         status: false,
            //         message: i18n.__("error.invalidDataReturnedByAI"),
            //         data: report
            //     };
            // }


            if(report?.overall_score){
                if(report.overall_score < 40){
                    report.overall_score_title = "Poor"
                }
                else if(report.overall_score >= 40 && report.overall_score <= 59){
                    report.overall_score_title = "Fairly Good"
                }
                else if(report.overall_score >= 60 && report.overall_score <= 79){
                    report.overall_score_title = "Good"
                }
                else if(report.overall_score >= 80 && report.overall_score <= 89){
                    report.overall_score_title = "Very Good"
                }
                else if(report.overall_score >= 90 && report.overall_score <= 100){
                    report.overall_score_title = "Excellent"
                }
            }

            console.log("5) Final report:");
            return { 
                status: true,
                metrics: parsedMetrics,
                data: report
            };

        } catch (error) {
            console.error("Error@analyzeBodyScan:", error);
            console.log(error, '==========error');
            return { 
                status: false, 
                message: i18n.__("error.unableToAnalyzeImage")
            };
        }
    }

    /** End Body Scan */


    /** Start Food Scan */

    // extractParsed = (response) => {

    //     const maybe = response?.output?.[0]?.content?.find(p => p?.parsed)?.parsed;
    //     if (maybe) 
    //         return maybe;

    //     try { 
    //         return JSON.parse(response?.output_text || ""); 
    //     } 
    //     catch { 
    //         return null; 
    //     }
    // }

    // analyzeFoodImage = async (imageUrl) => {

    //     const foodAnalysisSchema = {
    //         type: "object",
    //         additionalProperties: false,
    //         properties: {
    //             is_food: { type: "boolean" },
    //             result: { type: "string", enum: ["no", "ok"] },
    //             data: {
    //                 // null if not food; object if food
    //                 type: ["object", "null"],
    //                 additionalProperties: false,
    //                 properties: {
    //                     food_name: { type: "string" },
    //                     calories: { type: "number" },
    //                     protien: { type: "number" }, // (kept your exact key)
    //                     fats: { type: "number" },
    //                     carbs: { type: "number" },
    //                     quality_rating: { type: "number", minimum: 1, maximum: 100 },
    //                     ai_summary: { type: "string" },
    //                     tags: {
    //                         type: "array",
    //                         items: { type: "string" },
    //                     },
    //                     ingredients: {
    //                         type: "array",
    //                         items: {
    //                             type: "object",
    //                             additionalProperties: false,
    //                             properties: {
    //                                 title: { type: "string" },
    //                                 description: { type: "string" },
    //                                 image: { type: "string" }
    //                             },
    //                             required: ["title", "description", "image"]
    //                         }
    //                     },
    //                     substitutions: {
    //                         type: "array",
    //                         items: {
    //                             type: "object",
    //                             additionalProperties: false,
    //                             properties: {
    //                                 image: { type: "string" },
    //                                 title: { type: "string" },
    //                                 description: { type: "string" }
    //                             },
    //                             required: ["image", "title", "description"]
    //                         },
    //                         minItems: 1
    //                     }
    //                 },
    //                 // When data is an object, enforce all nutrition fields:
    //                 required: ["food_name", "calories", "protien", "fats", "carbs", "quality_rating", "ai_summary", "tags", "ingredients", "substitutions"]
    //             }
    //         },
    //         // Top-level: every key listed as required (per your error)
    //         required: ["is_food", "result", "data"]
    //     };

    //     const resp = await this.openai.responses.create({
    //         model: "gpt-5-mini",
    //         // response_format: { type: "json_schema", json_schema: responseSchema },
    //         input: [
    //             {
    //                 role: "user",
    //                 content: [
    //                     {
    //                         type: "input_text",
    //                         text: `
    //                                 You are a strict nutrition analyzer.

    //                                 Task:
    //                                 1) Determine if the image primarily shows FOOD.
    //                                 2) If NOT food: return an object with:
    //                                     - "is_food": false
    //                                     - "result": "no"
    //                                     Do NOT include any other fields.

    //                                 3) If food: return an object with:
    //                                     - "is_food": true
    //                                     - "food_name": a short, common name for the food (e.g., "Grilled Chicken Salad")
    //                                     - "calories": number (per single serving, approximate)
    //                                     - "Protien": number (grams)
    //                                     - "Fats": number (grams)
    //                                     - "carbs": number (grams)
    //                                     - "quality_rating": 1-100 (higher = better nutritional quality)
    //                                     - "ai_summary": 1-3 sentences summarizing the food's nutritional profile,
    //                                                     highlighting overall balance, strengths (e.g., rich in healthy fats),
    //                                                     and cautions (e.g., high sugar/fat content).
    //                                     - "tags": an array of relevant tags for the food, such as:
    //                                         - "High Protein"
    //                                         - "Low Fat"
    //                                         - "Fat Loss"
    //                                         - "High Cal"
    //                                         - "Low Carb"
    //                                         - "High Fiber"
    //                                     - "ingredients": array of major visible items; each has:
    //                                         - "title": short common name
    //                                         - "description": short note (can repeat name)
    //                                         - image: plausible public URL to a similar ingredient image (e.g., stock / Unsplash)
    //                                     - "substitutions": array (>=1) of smart alternatives, each with:
    //                                         - image: plausible public URL for that substitute
    //                                         - title: short name (e.g., "low-fat yogurt", "brown rice")
    //                                         - description: why it's a good swap (healthier, lower calorie, allergy-friendly, cheaper, regional, etc.)
    //                                 Rules:
    //                                     - Return ONLY a JSON object that matches the schema.
    //                                     - When is_food=false, include only { "is_food": false, "result": "no" }.
    //                                     - When is_food=true, do NOT include "result".
    //                                     - Make conservative, realistic estimates from the image; grams for macros.
    //                             `
    //                     },
    //                     { 
    //                         type: "input_image", 
    //                         image_url: imageUrl 
    //                     }
    //                 ]
    //             }
    //         ],
    //         text: {
    //             format: {
    //                 type: "json_schema",
    //                 name: "FoodAnalysis",
    //                 schema: foodAnalysisSchema,
    //                 strict: true
    //             }
    //         }
    //     });

    //     // console.log(resp, "========resp");

    //     return this.extractParsed(resp);
    // }

    // analyzeFoodScan = async (imageUrl) => {
    //     try {
            
    //         if(process.env.NODE_ENV == 'local'){
    //             imageUrl = "https://5.imimg.com/data5/SELLER/Default/2021/4/QP/YB/YG/126668561/a1-quality-mango.jpg";
    //         }

    //         const result = await this.analyzeFoodImage(imageUrl);
    //         if(!result){
    //             return { 
    //                 status: false, 
    //                 message: i18n.__("error.unableToAnalyzeFoodImage")
    //             };
    //         }

    //         // console.log(result, "===========result 1");
    //         if(!result){
    //             return { 
    //                 status: false, 
    //                 message: i18n.__("error.unableToAnalyzeImage")
    //             };
    //         }

    //         // console.log(result, "===========result 2");
    //         if(!result?.is_food){
    //             return { 
    //                 status: false, 
    //                 message: i18n.__("error.noFoodDetected")
    //             };
    //         }

    //         // console.log(result, "===========result 3");
    //         if(!result?.data){
    //             return { 
    //                 status: false, 
    //                 message: i18n.__("error.unableToAnalyzeImage")
    //             };
    //         }

    //         // console.log(JSON.stringify(result, null, 2));

    //         if(result.data?.quality_rating){
    //             if(result.data.quality_rating < 20){
    //                 result.data.quality_rating_title = "Poor"
    //             }
    //             else if(result.data.quality_rating >= 20 && result.data.quality_rating < 40){
    //                 result.data.quality_rating_title = "Fair"
    //             }
    //             else if(result.data.quality_rating >= 40 && result.data.quality_rating < 60){
    //                 result.data.quality_rating_title = "Fairly Good"
    //             }
    //             else if(result.data.quality_rating >= 60 && result.data.quality_rating < 80){
    //                 result.data.quality_rating_title = "Good"
    //             }
    //             else if(result.data.quality_rating >= 80){
    //                 result.data.quality_rating_title = "Excellent"
    //             }
    //         }

    //         return {
    //             status: true, 
    //             data: result.data
    //         };

    //     } catch (error) {
    //         console.error("Error@analyzeFoodScan:", error);

    //         return { 
    //             status: false, 
    //             message: i18n.__("error.unableToAnalyzeImage")
    //         };
    //     }
    // }

    // generateImage = async (prompt) => {
    //     try {
    //         const response = await this.openai.images.generate({
    //             model: "dall-e-3",
    //             prompt: `A high-quality photo of ${prompt} on a wooden table`, // white background
    //             n: 1,
    //             size: "1024x1024",
    //         });

    //         return response.data[0].url;

    //     } catch (error) {
    //         console.error(`Error generating image for "${prompt}":`, error.message);
    //         return null;
    //     }
    // }

    // generateAllImages = async (ingredients) => {

    //     try{
    //         const imagePromises = ingredients.map(async (ingredient) => {
    //             const url = await this.generateImage(ingredient.title);
    //             if(!url)
    //                 return false;

    //             return {
    //                 title: ingredient.title,
    //                 description: ingredient.description,
    //                 image: url,
    //             };
    //         });

    //         let results = await Promise.all(imagePromises);
    //         // console.log(JSON.stringify(results, null, 2));
    //         results = results.filter(item => item);

    //         return { 
    //             status: true,
    //             data: results
    //         };

    //     } catch (error) {
    //         console.error("Error@generateAllImages:", error);

    //         return { 
    //             status: false, 
    //             message: i18n.__("error.unableToGenerateIngredientImages")
    //         };
    //     }
    // }

    /** End Food Scan */

    /** Start Menu Scan */

    /** Using Completely Open AI */
    analyzeMenuWithOpenAI = async (imageUrl) => {

        const menuItemsAnalysisSchema = {
            type: "object",
            additionalProperties: false,
            properties: {
                is_food: { type: "boolean" },
                result: { type: "string", enum: ["no", "ok"] },
                data: {
                    // null if not food; array if food
                    type: ["array", "null"],
                    items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            food_name: { type: "string" },
                            calories: { type: "number" },
                            protien: { type: "number" }, // (kept your exact key)
                            fats: { type: "number" },
                            carbs: { type: "number" },
                            quality_rating: { type: "number", minimum: 1, maximum: 100 },
                            ai_summary: { type: "string" },
                            tags: {
                                type: "array",
                                items: { type: "string" },
                            },
                            ingredients: {
                                type: "array",
                                items: {
                                    type: "object",
                                    additionalProperties: false,
                                    properties: {
                                        title: { type: "string" },
                                        description: { type: "string" }
                                    },
                                    required: ["title", "description"]
                                }
                            }
                        },
                        // When data is an object, enforce all nutrition fields:
                        required: ["food_name", "calories", "protien", "fats", "carbs", "quality_rating", "ai_summary", "tags", "ingredients"]
                    },
                }
            },
            // Top-level: every key listed as required (per your error)
            required: ["is_food", "result", "data"]
        };

        const prompt = `
                        You are a menu parser bot.

                        Task:
                        1) Analyze the image of a restaurant menu.
                        2) If NOT food: return an object with:
                            - "is_food": false
                            - "result": "no"
                            Do NOT include any other fields.

                        3) If food: return an array of object with:
                            - "is_food": true
                            - "food_name": a short, common name for the food (e.g., "Grilled Chicken Salad")
                            - "calories": number (per single serving, approximate)
                            - "Protien": number (grams)
                            - "Fats": number (grams)
                            - "carbs": number (grams)
                            - "quality_rating": 1-100 (higher = better nutritional quality)
                            - "ai_summary": 1-3 sentences summarizing the food's nutritional profile,
                                            highlighting overall balance, strengths (e.g., rich in healthy fats),
                                            and cautions (e.g., high sugar/fat content).
                            - "tags": an array of relevant tags for the food, such as:
                                    - "High Protein"
                                    - "Low Fat"
                                    - "Fat Loss"
                                    - "High Cal"
                                    - "Low Carb"
                                    - "High Fiber"
                            - "ingredients": array of major visible items; each has:
                                - "title": short common name
                                - "description": short note (can repeat name)
                        Rules:
                            - Return ONLY a JSON object that matches the schema.
                            - When is_food=false, include only { "is_food": false, "result": "no" }.
                            - When is_food=true, do NOT include "result".
                            - Make conservative, realistic estimates from the image; grams for macros.
                    `;
                    
        const resp = await this.openai.responses.create({
            model: "gpt-5-mini",
            // response_format: { type: "json_schema", json_schema: responseSchema },
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: prompt
                        },
                        { 
                            type: "input_image", 
                            image_url: imageUrl 
                        }
                    ]
                }
            ],
            text: {
                format: {
                    type: "json_schema",
                    name: "MenuAnalysis",
                    schema: menuItemsAnalysisSchema,
                    strict: true
                }
            }
        });

        // console.log(resp, "========resp");

        return this.extractParsed(resp);
    }

    analyzeMenuScan = async (imageUrl) => {
        try {
            
            if(process.env.NODE_ENV == 'local'){
                imageUrl = "https://d1csarkz8obe9u.cloudfront.net/posterpreviews/daily-food-menu-card-for-restaurant-design-template-343e412e422270069dfee41a4c816970_screen.jpg";
            }

            // const result = await this.analyzeMenuWithOpenAI(foodItems.data, { batchSize: 20, hardTimeoutMs: 22000 });

            const result = await this.analyzeMenuWithOpenAI(imageUrl);

            if(!result){
                return { 
                    status: false, 
                    message: i18n.__("error.unableToAnalyzeImage")
                };
            }

            if(!result){
                return { 
                    status: false, 
                    message: i18n.__("error.unableToAnalyzeImage")
                };
            }

            // console.log(result, "===========result 2");
            if(!result?.is_food){
                return { 
                    status: false, 
                    message: i18n.__("error.noFoodItemsDetected")
                };
            }

            // console.log(result, "===========result 3");
            if(!result?.data){
                return { 
                    status: false, 
                    message: i18n.__("error.unableToAnalyzeImage")
                };
            }

            return {
                status: true, 
                data: result.data
            };

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
