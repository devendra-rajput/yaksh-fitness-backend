const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone')
const { v4: uuidv4 } = require('uuid');
const heicConvert = require("heic-convert");
const {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand 
} = require("@aws-sdk/client-s3");
const axios = require('axios');

/** Custom Require **/ 
const response = require('../helpers/v1/response.helpers');

class AWSService {

    constructor() {

        // Created AWS S3 instance
        this.s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });

        this.bucketName = process.env.AWS_S3_BUCKET_NAME;
    }

    // Upload a single file to AWS S3 after storing locally
    uploadFile = async (req, res, next) => {
        console.log('AWSService@uploadFile');

        if (req?.file?.path) {
            try {
                const file = req.file;

                const dateObj = new Date();
                const uploadDirectory = dateObj.getFullYear() + "/" + (dateObj.getMonth() + 1) + "/" + dateObj.getDate();
                let fileName = file.fieldname + '-' + uuidv4() + '-' + moment().unix() + path.extname(file.originalname);
                let contentType = file.mimetype;
                let fileBuffer = await fs.promises.readFile(file.path);

                // Convert HEIC to JPEG if necessary
                if (file.mimetype === "image/heic" || file.mimetype === "image/heif") {
                    const jpegBuffer = await heicConvert({
                        buffer: fileBuffer,
                        format: "JPEG",
                        quality: 0.8,
                    });

                    fileBuffer = jpegBuffer; // Use converted buffer
                    fileName = fileName.replace(/\.heic|\.heif$/, ".jpeg");
                    contentType = "image/jpeg";
                }

                // Defined S3 bucket params to upload the file
                const key = `${uploadDirectory}/${fileName}`;
                const params = {
                    Bucket: this.bucketName,
                    Key: key,
                    Body: fileBuffer,
                    // ACL: "public-read",
                    ContentType: contentType,
                };

                // Upload using v3 command
                const command = new PutObjectCommand(params);
                await this.s3.send(command);

                // Construct public URL manually
                const fileUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

                // Attached uploaded image URL with request for further use
                req.image_url = fileUrl;

                // Delete file after uploading to S3
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }

                next();

            } catch (error) {
                console.log('Upload error:', error);
                return response.badRequest("error.fileNotUploaded", res, false);
            }
        }
        else {
            next();
        }
    };

    uploadScanedFile = async (req) => {
        console.log('AWSService@uploadScanedFile');
        
        if(!req?.file?.path){
            return false;
        }

        try {
            const file = req.file;

            const dateObj = new Date();
            const uploadDirectory = "scan-images/" + dateObj.getFullYear() + "/" + (dateObj.getMonth() + 1) + "/" + dateObj.getDate();
            let fileName = file.fieldname + '-' + uuidv4() + '-' + moment().unix() + path.extname(file.originalname);
            let contentType = file.mimetype;
            let fileBuffer = await fs.promises.readFile(file.path);

            // Convert HEIC to JPEG if necessary
            if (file.mimetype === "image/heic" || file.mimetype === "image/heif") {
                const jpegBuffer = await heicConvert({
                    buffer: fileBuffer,
                    format: "JPEG",
                    quality: 0.8,
                });

                fileBuffer = jpegBuffer; // Use converted buffer
                fileName = fileName.replace(/\.heic|\.heif$/, ".jpeg");
                contentType = "image/jpeg";
            }

            // Defined S3 bucket params to upload the file
            const key = `${uploadDirectory}/${fileName}`;
            const params = {
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                // ACL: "public-read",
                ContentType: contentType,
            };

            // Upload using v3 command
            const command = new PutObjectCommand(params);
            await this.s3.send(command);

            // Construct public URL manually
            const fileUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

            return fileUrl;

        } catch (error) {
            console.log('Upload error:', error);
            return false;
        }
    };

    uploadImageToS3FromImageUrl = async (imageUrl) => {
        try {
            // Step 1: Download the image from the public URL
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');
            
            // Step 2: Set S3 upload parameters
            const dateObj = new Date();
            const uploadDirectory = "ingredient-images/" + dateObj.getFullYear() + "/" + (dateObj.getMonth() + 1) + "/" + dateObj.getDate();
            let fileName = uuidv4() + '-' + moment().unix() + ".png";

            // Defined S3 bucket params to upload the file
            const key = `${uploadDirectory}/${fileName}`;
            const params = {
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                // ACL: "public-read",
                ContentType: "image/png"
            };
            
            // Upload using v3 command
            const command = new PutObjectCommand(params);
            await this.s3.send(command);

            // Construct public URL manually
            const fileUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

            return fileUrl;

        } catch (error) {
            console.error('Error uploading image to S3:', error);
            return false;
        }
    };

    uploadIngredientImages = async (ingredientImages) => {
    
        try{
            const imagePromises = ingredientImages.map(async (item) => {
                const url = await this.uploadImageToS3FromImageUrl(item.image);
                return {
                    title: item.title,
                    description: item.description,
                    image: url || false,
                };
            });

            const results = await Promise.all(imagePromises);
            // console.log(JSON.stringify(results, null, 2));

            return { 
                status: true,
                data: results
            };

        } catch (error) {
            console.error("Error@uploadIngredientImages:", error);

            return { 
                status: false, 
                message: i18n.__("error.unableToUploadIngredientImages")
            };
        }
    }

    deleteFile = async (fileUrl) => {
        console.log('AWSService@deleteFile');

        // const bucket = process.env.AWS_S3_BUCKET_NAME;
        const url = new URL(fileUrl);
        const key = decodeURIComponent(url.pathname.substring(1)); // remove leading `/`

        try {

            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            await this.s3.send(command);
            
            return true;

        } catch (err) {
            return false;
        }
    }

    uploadVideo = async (localFilePath) => {
        console.log('AWSService@uploadVideo');

        try {
            if (!localFilePath || !fs.existsSync(localFilePath)) {
                return false;
            }

            const dateObj = new Date();
            const uploadDirectory = dateObj.getFullYear() + "/" + (dateObj.getMonth() + 1) + "/" + dateObj.getDate();

            const originalName = path.basename(localFilePath);

            let baseName = originalName.replace(path.extname(originalName), "");

            baseName = baseName.toLowerCase()
                                .replace(/[^a-z0-9]+/g, "-")
                                .replace(/-+/g, "-")
                                .replace(/^-|-$/g, "");

            const ext = path.extname(originalName);

            const fileName = `${baseName}-${uuidv4()}-${moment().unix()}${ext}`;
            const fileBuffer = await fs.promises.readFile(localFilePath);

            const key = `${uploadDirectory}/${fileName}`;
            const params = {
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                // ACL: "public-read",
                ContentType: "video/mp4",
            };

            // Upload using v3 command
            const command = new PutObjectCommand(params);
            await this.s3.send(command);

            // Construct public URL manually
            const fileUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

            return fileUrl;

        } catch (err) {
            console.log("Upload local video error:", err);
            return false;
        }
    };

    uploadLocalFileToS3 = async (localPath) => {
        console.log('AWSService@uploadLocalFileToS3');

        try {
            
            if (!fs.existsSync(localPath)) {
                console.log("Local file not found: " + localPath);
                return false;
            }

            let fileBuffer = await fs.promises.readFile(localPath);

            const originalName = path.basename(localPath);
            const ext = path.extname(originalName);
            const baseName = path.basename(localPath, ext);

            // Remove space and uppercase
            const cleanName = baseName
                                    .toLowerCase()
                                    .replace(/\s+/g, "-")
                                    .replace(/[^a-z0-9\-]/g, "");

            const uuid = uuidv4().split("-")[0];

            const dateObj = new Date();
            const uploadDirectory = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

            let fileName = `${cleanName}-${uuid}${ext}`;

            const key = `${uploadDirectory}/${fileName}`;
            const params = {
                Bucket: process.env.AWS_S3_EXERCISE_BUCKET_NAME,
                Key: key,
                Body: fileBuffer,
                // ACL: "public-read",
                ContentType: "image/png",
            };

            // Upload using v3 command
            const command = new PutObjectCommand(params);
            await this.s3.send(command);

            // Construct public URL manually
            const fileUrl = `https://${process.env.AWS_S3_EXERCISE_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

            return fileUrl;

        } catch (error) {
            console.error("Local file upload error:", error);
            return false;
        }
    };

    isFileExist = async (fileUrl) => {
        try {

            const urlObj = new URL(fileUrl);
            const bucket = urlObj.hostname.split(".")[0];

            // const key = urlObj.pathname.slice(1);
            const key = decodeURIComponent(urlObj.pathname.slice(1));

            const params = {
                Bucket: bucket,
                Key: key
            };

            const command = new HeadObjectCommand(params);
            await this.s3.send(command);

            return true;
        } 
        catch (err) {
            if (err.name === "NotFound") 
                return false;
            
            console.log(err, "=======err");
            throw err; // other errors
        }
    }

}

// Export all functions
module.exports = new AWSService;