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

// 静态资源路由应放在 JWT 校验之前
app.use('/', express.static(path.join(__dirname, 'home')));
app.use('/assets', express.static(path.join(__dirname, '/node_modules/@salesforce-ux/design-system/assets')));

// 优先从环境变量读取密钥，兼容 launch.json 的 env 配置
const SFMC_JWT_SECRET = process.env.SFMC_JWT_SECRET || 'your_sfmc_jwt_signing_secret';

// JWT 校验中间件
function verifySFMCJwt(req, res, next) {
    const excludeUrls = [
        '/modules/discount-code',
        '/modules/discount-code/',
        '/modules/discount-redemption-split',
        '/modules/discount-redemption-split/'
    ];
    // 排除页面路径和所有静态资源（.html, .css, .js, .png, .jpg, .svg, .ico, .gif, .woff2, .woff, .ttf, .eot等）
    if (
        excludeUrls.includes(req.originalUrl) ||
        req.originalUrl.match(/^\/modules\/discount-code\/.*\.(html|css|js|png|jpg|jpeg|svg|ico|gif|woff2|woff|ttf|eot)$/i) ||
        req.originalUrl.match(/^\/modules\/discount-redemption-split\/.*\.(html|css|js|png|jpg|jpeg|svg|ico|gif|woff2|woff|ttf|eot)$/i)
    ) {
        return next();
    }
    // JWT 可能在 header 或 body
    const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '') || req.body?.jwt || req.query?.jwt;
    if (!token) {
        return res.status(401).json({ error: 'Missing JWT token' });
    }
    jwt.verify(token, SFMC_JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid JWT token' });
        }
        // 可根据 decoded 进一步校验 issuer、audience 等
        req.sfmcJwt = decoded;
        next();
    });
}

// 只保护API接口（所有 discount-code 和 discount-redemption-split 下的接口）
app.use('/modules/discount-code', verifySFMCJwt);
app.use('/modules/discount-redemption-split', verifySFMCJwt);

// 必须在注册submodules之前
submodules.forEach((sm) => sm(app, {
    rootDirectory: __dirname,
}));

app.listen(app.get('port'), function() {
    console.log(`Express is running at localhost: ${app.get('port')}`);
});
