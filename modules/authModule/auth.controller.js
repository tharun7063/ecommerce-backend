// modules/authModule/auth.controller.js

const authService = require('./auth.service');
const config = require('../../config.json');
const express = require('express');
const Joi = require('joi');
const auth = require('../../middleware/authMiddleware');


const router = express.Router();

async function authenticateUsernameSchema(req, res, next) {
    const { auth_type } = req.body;

    // common device schema
    const deviceSchema = {
        device_id: Joi.string().max(128).required(),
        device_type: Joi.string().valid("MOBILE", "TABLET", "DESKTOP", "WEB").required()
    };

    let schema;

    if (auth_type === 'email') {
        schema = Joi.object({
            action: Joi.string().valid('sign_in', 'sign_up').required(),
            email: Joi.string().email().trim().lowercase().required(),
            password: Joi.string().min(6).required(),
            auth_type: Joi.string().valid('email').required(),
            ...deviceSchema
        });
    } else if (auth_type === 'mobile') {
        schema = Joi.object({
            countryCode: Joi.string()
                .pattern(/^0\d{1,3}$/)   // must start with "0", followed by 1-3 digits
                .required()
                .messages({
                    "string.pattern.base": "countryCode must start with 0 followed by 1-3 digits (e.g., 091 for India, 061 for Australia)"
                }),
            mobile: Joi.string()
                .pattern(/^\d{4,15}$/)   // digits only, 4 to 15 length
                .required(),
            password: Joi.string().min(6).required(),
            auth_type: Joi.string().valid('mobile').required(),
            ...deviceSchema
        });
    } else {
        return res.status(400).json({
            success: false,
            message: "Invalid auth_type"
        });
    }

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
    }
    next();
}

async function authenticatePassSchema(req, res, next) {
    const { auth_type } = req.body;

    const deviceSchema = {
        device_id: Joi.string().max(128).required(),
        device_type: Joi.string().valid("MOBILE", "TABLET", "DESKTOP", "WEB").required()
    };

    let schema;

    if (auth_type === 'email') {
        schema = Joi.object({
            email: Joi.string().email().trim().lowercase().required(),
            auth_type: Joi.string().valid('email').required(),
            otp: Joi.string()
                .pattern(/^\d{6}$/)
                .required()
                .messages({ "string.pattern.base": "OTP must be a 6-digit number" }),
            ...deviceSchema
        });
    } else if (auth_type === 'mobile') {
        schema = Joi.object({
            countryCode: Joi.string()
                .pattern(/^0\d{1,3}$/)
                .required()
                .messages({
                    "string.pattern.base": "countryCode must start with 0 followed by 1–3 digits (e.g., 091)"
                }),
            mobile: Joi.string()
                .pattern(/^\d{4,15}$/)
                .required()
                .messages({
                    "string.pattern.base": "mobile must be 4–15 digits"
                }),
            auth_type: Joi.string().valid('mobile').required(),
            otp: Joi.string()
                .pattern(/^\d{6}$/)
                .required()
                .messages({ "string.pattern.base": "OTP must be a 6-digit number" }),
            ...deviceSchema
        });
    } else {
        return res.status(400).json({
            success: false,
            message: "Invalid auth_type"
        });
    }

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
    }
    next();
}

async function resendOtpSchema(req, res, next) {
    const { auth_type } = req.body;

    let schema;
    if (auth_type === 'email') {
        schema = Joi.object({
            email: Joi.string().email().trim().lowercase().required(),
            auth_type: Joi.string().valid('email').required()
        });
    } else if (auth_type === 'mobile') {
        schema = Joi.object({
            countryCode: Joi.string()
                .pattern(/^0\d{1,3}$/)
                .required()
                .messages({
                    "string.pattern.base": "countryCode must start with 0 followed by 1–3 digits (e.g., 091)"
                }),
            mobile: Joi.string()
                .pattern(/^\d{4,15}$/)
                .required()
                .messages({
                    "string.pattern.base": "mobile must be 4–15 digits"
                }),
            auth_type: Joi.string().valid('mobile').required()
        });
    } else {
        return res.status(400).json({
            success: false,
            message: "Invalid auth_type"
        });
    }

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
    }
    next();
}




router.post('/authenticate', authenticateUsernameSchema, async (req, res, next) => {
    try {
        const result = await authService.authenticateUser(req);
        res.cookie("refreshToken", result.refresh_token, {
            httpOnly: true,
            secure: true,
            sameSite: "Strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

router.post('/authenticate-pass', authenticatePassSchema, async (req, res, next) => {
    try {
        const result = await authService.authenticatePass(req);

        if (!result.success) {
            return res.status(result.errorCode || 400).json(result);
        }

        res.cookie("refreshToken", result.refresh_token, {
            httpOnly: true,
            secure: true,
            sameSite: "Strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

router.post('/refresh-token', async (req, res, next) => {
    try {
        const result = await authService.refreshToken(req);

        if (result.status && result.status !== 200) {
            return res.status(result.status).json(result);
        }

        if (result.refreshToken) {
            res.cookie("refreshToken", result.refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: "Strict",
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
});

router.post('/resend-otp', resendOtpSchema, async (req, res, next) => {
    try {
        const result = await authService.resendOtp(req);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

router.get(
  '/',
  auth.authenticate,
  auth.authorizeAdminOnly,
  authService.getAllUsers
);

// Get single user by UID (for details page)
router.get(
  '/:uid',
  auth.authenticate,
  auth.authorizeAdminOnly,
  authService.getUserByUid
);




module.exports = router;
