const express = require('express');
const path = require('path');
const bodyParser = require('body-parser')
const jwt = require('jsonwebtoken');

const submodules = [
    require('./modules/discount-code/app/app'),
    require('./modules/discount-redemption-split/app/app'),
];

const app = express();

// parse application/json
app.use(bodyParser.json())

app.set('port', (process.env.PORT || 8080));

// Static resource routes should be before JWT middleware
app.use('/', express.static(path.join(__dirname, 'home')));
app.use('/assets', express.static(path.join(__dirname, '/node_modules/@salesforce-ux/design-system/assets')));

// Prefer to read the secret from environment variables, compatible with launch.json env config
const SFMC_JWT_SECRET = process.env.SFMC_JWT_SECRET || 'your_sfmc_jwt_signing_secret';

// JWT verification middleware
function verifySFMCJwt(req, res, next) {
    console.log('### SFMC_JWT_SECRET:', SFMC_JWT_SECRET);
    const excludeUrls = [
        '/modules/discount-code',
        '/modules/discount-code/',
        '/modules/discount-redemption-split',
        '/modules/discount-redemption-split/'
    ];
    // Exclude page paths and all static resources (.html, .css, .js, .png, .jpg, .svg, .ico, .gif, .woff2, .woff, .ttf, .eot, etc.)
    if (
        excludeUrls.includes(req.originalUrl) ||
        req.originalUrl.match(/^\/modules\/discount-code\/.*\.(html|css|js|png|jpg|jpeg|svg|ico|gif|woff2|woff|ttf|eot)$/i) ||
        req.originalUrl.match(/^\/modules\/discount-redemption-split\/.*\.(html|css|js|png|jpg|jpeg|svg|ico|gif|woff2|woff|ttf|eot)$/i)
    ) {
        return next();
    }
    // JWT may be in header or body
    const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '') || req.body?.jwt || req.query?.jwt;
    if (!token) {
        return res.status(401).json({ error: 'Missing JWT token' });
    }
    jwt.verify(token, SFMC_JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid JWT token' });
        }
        // You can further validate issuer, audience, etc. from decoded
        req.sfmcJwt = decoded;
        next();
    });
}

// Only protect API endpoints (all discount-code and discount-redemption-split subpaths)
app.use('/modules/discount-code', verifySFMCJwt);
app.use('/modules/discount-redemption-split', verifySFMCJwt);

// Must register submodules after middleware
submodules.forEach((sm) => sm(app, {
    rootDirectory: __dirname,
}));

app.listen(app.get('port'), function() {
    console.log(`Express is running at localhost: ${app.get('port')}`);
});
