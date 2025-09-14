const express = require('express');
const Joi = require('joi');
const brandService = require('./brand.service');
const router = express.Router();
const auth = require('../../../middleware/authMiddleware');

// Validation Schema
function addBrandSchema(req, res, next) {
    const singleSchema = Joi.object({
        name: Joi.string().trim().max(255).required(),
        slug: Joi.string().trim().lowercase().max(255).required(),
        description: Joi.string().allow(null, ''),
        logo_url: Joi.string().uri().allow(null, ''),
    });

    const schema = Joi.alternatives().try(
        singleSchema,
        Joi.array().items(singleSchema).min(1)
    );

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }
    next();
}

// Controller
async function addBrandController(req, res) {
    try {
        const result = await brandService.addBrand(req);
        if (result.success) {
            return res.status(201).json(result);
        }
        return res.status(400).json(result);
    } catch (err) {
        console.error("Error in addBrand:", err);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
}

async function getAllBrands(req, res) {
    try {
        const result = await brandService.getAllBrands();
        return res.status(200).json(result);
    } catch (err) {
        console.error("Error in getAllBrands:", err);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
}

// Route
router.post(
    '/add',
    auth.authenticate,
    auth.authorizeSellerOrAdmin,
    addBrandSchema,
    addBrandController
);
router.get('/', getAllBrands);

module.exports = router;
