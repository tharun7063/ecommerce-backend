// product.controller.js
const express = require('express');
const Joi = require('joi');
const productService = require('./product.service');
const router = express.Router();
const auth = require('../../../middleware/authMiddleware');
const multer = require("multer");
const { parse } = require('uuid');
const { JSON } = require('sequelize');
const upload = multer();



// Validation Schema
function addProductSchema(req, res, next) {
    try {
        if (typeof req.body.options === "string") {
            req.body.options = JSON.parse(req.body.options);
        }
        if (typeof req.body.variants === "string") {
            req.body.variants = JSON.parse(req.body.variants);
        }
    } catch (e) {
        return res.status(400).json({ success: false, message: "Invalid JSON in options, variants" });
    }

    const schema = Joi.object({
        name: Joi.string().required(),
        slug: Joi.string().required(),
        description: Joi.string().required(),
        short_description: Joi.string().allow(null, ''),
        price: Joi.number().precision(2).required(),
        discount_price: Joi.number().precision(2).allow(null),
        stock_quantity: Joi.number().integer().min(0).allow(null),
        status: Joi.string().valid("active", "inactive", "draft").default("active"),
        category_id: Joi.number().required(),
        brand_id: Joi.number().allow(null),
        options: Joi.array().default([]),
        variants: Joi.array().default([]),
    });

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details.map(d => d.message).join(', ')
        });
    }

    req.body = value;
    next();
}

// Controller
async function addProduct(req, res) {
    const result = await productService.addProduct(req);
    if (result.success) {
        return res.status(201).json(result);
    }
    return res.status(400).json(result);
}

function addProductMediaSchema(req, res, next) {
    const schema = Joi.object({
        name: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
        ).optional()
    });

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details.map((d) => d.message).join(", "),
        });
    }

    req.body = value;
    next();
}

async function addProductMedia(req, res) {
    const result = await productService.addProductMedia(req);
    if (result?.success === false) {
        return res.status(400).json(result);
    }
    return res.status(201).json(result);
}

async function getAllProducts(req, res) {
    try {
        const result = await productService.getAllProducts();
        return res.status(200).json(result);
    } catch (err) {
        console.error("Error in getAllProducts:", err);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
}

async function getProductByUid(req, res) {
    try {
        const result = await productService.getProductByUid(req);

        if (result.success) {
            return res.status(201).json(result);
        }
        return res.status(400).json(result);
    } catch (err) {
        console.error("Error in getProductByUid:", err);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
}




// Routes
router.post("/add", auth.authenticate, auth.authorizeSellerOrAdmin, addProductSchema, addProduct);
router.post(
    "/:product_id/media",
    auth.authenticate,
    auth.authorizeSellerOrAdmin,
    upload.array("media", 12),
    addProductMediaSchema,
    addProductMedia
);

router.get('/', getAllProducts);
router.get('/:uid', getProductByUid);



module.exports = router;
