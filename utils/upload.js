/**
 * Upload Utility
 * Handles file uploads using Multer with validation
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');
const i18n = require('../config/i18n');

/**
 * Default upload configuration
 */
const DEFAULT_CONFIG = {
  fileTypes: /jpg|jpeg|png|heic/,
  maxFileSize: 5 * 1024 * 1024, // 5 MB
  defaultDirectory: 'uploads/default',
};

/**
 * Generate unique filename
 */
const generateUniqueFilename = (fieldname, originalname) => {
  const timestamp = moment().unix();
  const uniqueId = uuidv4();
  const extension = path.extname(originalname);

  return `${fieldname}-${uniqueId}-${timestamp}${extension}`;
};

/**
 * Ensure directory exists, create if not
 */
const ensureDirectoryExists = (directoryPath) => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(directoryPath)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

/**
 * Validate file type against regex
 */
const isValidFileType = (filename, typeRegex) => {
  const extension = path.extname(filename).toLowerCase();
  return typeRegex.test(extension);
};

/**
 * Create Multer storage configuration
 */
const createStorage = (directoryPath = DEFAULT_CONFIG.defaultDirectory) => multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirectoryExists(directoryPath);
    cb(null, directoryPath);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = generateUniqueFilename(file.fieldname, file.originalname);
    cb(null, uniqueFilename);
  },
});

/**
 * Create file filter for validation
 */
const createFileFilter = (typeRegex) => (req, file, cb) => {
  if (isValidFileType(file.originalname, typeRegex)) {
    cb(null, true);
  } else {
    cb(new Error(i18n.__('error.invalidFileType')));
  }
};

/**
 * Create configured file uploader
 */
const createFileUploader = (
  typeRegex = DEFAULT_CONFIG.fileTypes,
  fileSize = DEFAULT_CONFIG.maxFileSize,
  directoryPath = DEFAULT_CONFIG.defaultDirectory,
) => {
  const storage = createStorage(directoryPath);
  const fileFilter = createFileFilter(typeRegex);

  return multer({
    storage,
    limits: { fileSize },
    fileFilter,
  });
};

/**
 * Set maximum file limit middleware
 */
const setMaxFileLimit = (maxCount) => (req, res, next) => {
  req.maxFileCount = maxCount;
  next();
};

/**
 * Main upload file function
 */
const uploadFile = (
  type = DEFAULT_CONFIG.fileTypes,
  fileSize = DEFAULT_CONFIG.maxFileSize,
  directoryPath = DEFAULT_CONFIG.defaultDirectory,
) => createFileUploader(type, fileSize, directoryPath);

module.exports = {
  uploadFile,
  setMaxFileLimit,
};
