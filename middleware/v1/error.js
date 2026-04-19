const multer = require('multer');

/** Custom Require **/
const i18n = require('../../config/v1/i18n');

module.exports = function(err, req, res, next) {
    console.log('ErrorMiddleware', err);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                msg: i18n.__('error.tooManyFilesUploaded'),
                error: i18n.__('error.maxFileLimit', {maxFileCount: req.maxFileCount || 5}),
            });
        }
    
        return res.status(400).json({
          msg: i18n.__('error.multerError'),
          error: err.message,
        });
    }

    let errorMessage = typeof err == 'string' ? err : err.message;
    return res.status(500).json({
        msg: i18n.__('error.serverError'),
        error: errorMessage || i18n.__('error.internalServerError'),
    });
}