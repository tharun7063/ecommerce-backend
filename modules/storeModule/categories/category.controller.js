const express = require('express');
const Joi = require('joi');
const categoryService = require('./category.service');
const router = express.Router();


function addCategorySchema(req, res, next) {
    const singleCategorySchema = Joi.object({
        name: Joi.string().max(255).required(),
        description: Joi.string().max(500).required(),
        parent_id: Joi.number().integer().allow(null) // optional
    });

    // Allow either a single object or an array of objects
    const schema = Joi.alternatives().try(
        singleCategorySchema,
        Joi.array().items(singleCategorySchema).min(1)
    );

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details.map(d => d.message).join(", ")
        });
    }
    next();
}

function updateCategorySchema(req, res, next) {
    const schema = Joi.object({
        name: Joi.string().max(255).optional(),
        description: Joi.string().max(500).optional(),
        parent_id: Joi.number().integer().allow(null).optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }
    next();
}

router.post('/addCategory', addCategorySchema,
    async (req, res, next) => {
        try {
            const result = await categoryService.addCategory(req);
            if (result.success) {
                return res.status(201).json(result);
            }
            return res.status(400).json(result);
        } catch (err) {
            next(err);
        }
    }
);

router.get('/categories', async (req, res, next) => {
    try {
        const result = await categoryService.getAllCategory(req, res);
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to fetch categories'
        });
    }
});

router.get('/:uid', async (req, res) => {
    const result = await categoryService.getCategoryByUid(req);
    res.status(result.success ? 200 : 404).json(result);
});

router.put('/:uid', updateCategorySchema, async (req, res) => {
    try {
        const result = await categoryService.updateCategory(req);
        res.status(result.success ? 200 : 404).json(result);
    } catch (err) {
        console.error("Update category error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to update category"
        });
    }
});

router.delete('/:uid', async (req, res) => {
    try {
        const result = await categoryService.deleteCategory(req);
        res.status(result.success ? 200 : 404).json(result);
    } catch (err) {
        console.error("Delete category error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to delete category"
        });
    }
});

module.exports = router;
