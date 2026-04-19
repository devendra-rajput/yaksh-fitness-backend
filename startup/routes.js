const express = require('express');
const routes = express.Router();
const fs = require('fs').promises
const path = require('path')

async function walk(dir, fileList = []) {
    const files = await fs.readdir(dir)
    for (const file of files) {
        const stat = await fs.stat(path.join(dir, file))
        if (stat.isDirectory()) fileList = await walk(path.join(dir, file), fileList)
        else fileList.push(path.join(dir, file))
    }
    return fileList
}

module.exports = async function (app) {

    allFiles = await walk('routes');
    
    await allFiles.forEach(file => {
        let fileNameArray = file.split('.')[0];
        let routeName = fileNameArray.split('/')[1] ? fileNameArray.split('/')[1] : fileNameArray.split('\\')[1];
        console.log('registering route: ', routeName);
        app.use(`/api/v1/${routeName}`, require(`../${fileNameArray}`));
    });

    app.get('/', function (req, res, next) {
        return res.status(200).send({
            msg: 'Everything is working fine.',
            host: req.get('host'),
        })
    });

    /** Render Static Pages */
    app.get('/terms', (req, res) => {
        res.render('terms');
    });

    app.get('/privacy', (req, res) => {
        res.render('privacy');
    });

    app.get('/stripe/reauth', (req, res) => {
        res.render('stripeCallback', { queryParams: req.query });
    });

    app.get('/stripe/dashboard', (req, res) => {
        res.render('stripeCallback', { queryParams: req.query });
    });

    // Middleware to handle "route not found" errors
    app.use((req, res, next) => {
        return res.status(404).send({
            msg: `'${req.originalUrl}' is not a valid endpoint. Please check the request URL and try again.`
        });
    });
}