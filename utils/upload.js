const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone')
const { v4: uuidv4 } = require('uuid');

/** Custom Require **/
const i18n = require('../config/v1/i18n');

class Upload {
    // Create a Multer disk storage configuration
    createStorage = (directoryPath = 'uploads/default') => {
        return multer.diskStorage({
            destination: (req, file, cb) => {
                // Create the directory if it doesn't exist
                fs.mkdirSync(directoryPath, { recursive: true });
                cb(null, directoryPath);
            },
            filename: (req, file, cb) => {
                // Generate a unique file name using current timestamp
                cb(null, file.fieldname + '-' + uuidv4() + '-' + moment().unix() + path.extname(file.originalname));
            }
        });
    };

    // Create a general-purpose uploader with file type and size validation
    fileUploader = (typeRegex, fileSize, directoryPath) => {
        const storage = this.createStorage(directoryPath);
        return multer({
            storage,
            limits: { fileSize },
            fileFilter: (req, file, cb) => {
                const extname = typeRegex.test(path.extname(file.originalname).toLowerCase());
                return extname ? cb(null, true) : cb(i18n.__('error.invalidFileType'));
            }
        });
    };

    /**
     * 
     * @param { /jpg|jpeg|png|heic/ } type 
     * @param { 10 MB } fileSize 
     * @param { Default uploads path} directoryPath 
     * @returns
     */
    uploadFile = (type = /jpg|jpeg|png|heic/, fileSize = 10 * 1024 * 1024, directoryPath = 'uploads/default') => {
        return this.fileUploader(type, fileSize, directoryPath);
    };

    setMaxFileLimit = (maxCount) => (req, res, next) => {
        req.maxFileCount = maxCount;
        next();
    };
}

module.exports = new Upload;