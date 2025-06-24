const express = require('express');
const path = require('path');
const bodyParser = require('body-parser')
const jwt = require('jsonwebtoken');

const submodules = [
    require('./modules/discount-code/app/app'),
    require('./modules/discount-redemption-split/app/app'),
];

const app = express();

// Add this before app.use(bodyParser.json())
app.use('/modules/discount-code/validate', bodyParser.text({ type: 'application/jwt' }));
app.use('/modules/discount-code/execute', bodyParser.text({ type: 'application/jwt' }));
app.use('/modules/discount-code/save', bodyParser.text({ type: 'application/jwt' }));
app.use('/modules/discount-code/publish', bodyParser.text({ type: 'application/jwt' }));
app.use('/modules/discount-code/stop', bodyParser.text({ type: 'application/jwt' }));

app.use('/modules/discount-redemption-split/execute', bodyParser.text({ type: 'application/jwt' }));
app.use('/modules/discount-redemption-split/save', bodyParser.text({ type: 'application/jwt' }));
app.use('/modules/discount-redemption-split/publish', bodyParser.text({ type: 'application/jwt' }));
app.use('/modules/discount-redemption-split/validate', bodyParser.text({ type: 'application/jwt' }));
app.use('/modules/discount-redemption-split/stop', bodyParser.text({ type: 'application/jwt' }));

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
    console.log("### req.headers:", req.headers);
    let token =
        req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
        req.body?.jwt ||
        req.query?.jwt;

    // If content-type is application/jwt, the body is the raw JWT string
    if (
        !token &&
        req.headers['content-type'] &&
        req.headers['content-type'].toLowerCase().startsWith('application/jwt') &&
        typeof req.body === 'string'
    ) {
        token = req.body;
    }

    console.log("### JWT token received:", token);

    if (!token) {
        console.log("### Missing JWT token");
        return res.status(401).json({ error: 'Missing JWT token' });
    }
    
    jwt.verify(token, SFMC_JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
            console.error("### JWT verification failed:", err);
            return res.status(401).json({ error: 'Invalid JWT token' });
        }
        // Only assign if decoded has content
        if (decoded && Object.keys(decoded).length > 0) {
            req.reqPayload = decoded;
            console.log("### Request Payload from JB:", req.reqPayload);
        } else {
            console.warn("### Decoded JWT is empty, req.reqPayload not set.");
        }
        console.log("### JWT verification success!");
        next();
    });
}

// Only protect specific API endpoints
app.use('/modules/discount-code/execute', verifySFMCJwt);
app.use('/modules/discount-code/save', verifySFMCJwt);
app.use('/modules/discount-code/publish', verifySFMCJwt);
app.use('/modules/discount-code/validate', verifySFMCJwt);
app.use('/modules/discount-code/stop', verifySFMCJwt);

app.use('/modules/discount-redemption-split/execute', verifySFMCJwt);
app.use('/modules/discount-redemption-split/save', verifySFMCJwt);
app.use('/modules/discount-redemption-split/publish', verifySFMCJwt);
app.use('/modules/discount-redemption-split/validate', verifySFMCJwt);
app.use('/modules/discount-redemption-split/stop', verifySFMCJwt);

// Must register submodules after middleware
submodules.forEach((sm) => sm(app, {
    rootDirectory: __dirname,
}));

app.listen(app.get('port'), function() {
    console.log(`Express is running at localhost: ${app.get('port')}`);
});
