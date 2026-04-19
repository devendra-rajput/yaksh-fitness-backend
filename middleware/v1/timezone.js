module.exports = (req, res, next) => {
    // Extract timezone from headers, default to UTC
    req.timezone = req.headers.timezone || req.headers['x-timezone'] || 'UTC';
    next();
};
