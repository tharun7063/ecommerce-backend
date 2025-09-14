const { where } = require('sequelize');
const db = require('../../../db');
const cloudinary = require('cloudinary').v2;
const config = require('../../../config.json')
const path = require('path')
const fs = require('fs')






cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET
});





async function safeUnlink(path) {
    try {
        await fs.unlink(path);
    } catch (err) {
        if (err.code !== "ENOENT") {
            console.error("Failed to delete temp file:", err);
        }
    }
}

function generateSKU(productName, variantOptions = []) {
    const cleanProductName = productName.replace(/[^a-zA-Z0-9]/g, '');
    const prefix = cleanProductName.substring(0, 3).toUpperCase();

    const optionPart = variantOptions
        .map(opt => opt.replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase())
        .join('-');

    const uniquePart = Date.now().toString(36) + Math.random().toString(36).substring(2, 5).toUpperCase();

    return [prefix, optionPart, uniquePart].filter(Boolean).join('-');
}

function uploadToCloudinary(fileBuffer, mimetype, product_id, originalname) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: mimetype.startsWith("video/") ? "video" : "image",
                folder: "products",
                public_id: `product-${product_id}-${Date.now()}-${path.parse(originalname).name}`,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        stream.end(fileBuffer);
    });
}






async function addProduct(req) {
    const t = await db.sequelize.transaction();

    try {
        const {
            name,
            slug,
            description,
            short_description,
            price,
            discount_price,
            stock_quantity,
            status,
            category_id,
            brand_id,
            options = [],
            variants = []
        } = req.body;

        console.log("======== Incoming Request Body ========");
        console.log(req.body);

        const userUid = req.user.uid;

        // 1. Validate category exists
        const category = await db.Category.findByPk(category_id);
        if (!category) return { success: false, message: "Category not found" };

        if (brand_id) {
            const brand = await db.Brand.findByPk(brand_id);
            if (!brand) return { success: false, message: "Brand not found" };
        }

        // 2. Validate slug
        const existingSlug = await db.Product.findOne({ where: { slug } });
        if (existingSlug) return { success: false, message: "Slug must be unique" };

        // 3. Generate product SKU
        let sku;
        let exists = true;
        while (exists) {
            sku = generateSKU(name);
            exists = await db.Product.findOne({ where: { sku } });
        }

        // 4. Calculate product stock = sum of variant stocks (or fallback if no variants)
        let totalStock = 0;
        if (variants && variants.length) {
            totalStock = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
        } else {
            totalStock = stock_quantity || 0; // fallback when no variants exist
        }

        // 5. Create base product
        const product = await db.Product.create({
            name,
            slug,
            description,
            short_description,
            price,
            discount_price: discount_price || null,
            sku,
            stock_quantity: totalStock,
            status: status || "active",
            category_id,
            brand_id: brand_id || null,
            created_by: userUid,
            updated_by: userUid
        }, { transaction: t });

        // 6. Create options & option values
        const optionValueMap = {}; // { "Red": id, "M": id, ... }

        for (const opt of options) {
            const option = await db.ProductOption.create(
                {
                    product_id: product.id, name: opt.name, created_by: userUid,
                    updated_by: userUid
                },
                { transaction: t }
            );

            for (const val of opt.values) {
                const optionValue = await db.ProductOptionValue.create(
                    {
                        option_id: option.id, value: val, created_by: userUid,
                        updated_by: userUid
                    },
                    { transaction: t }
                );
                optionValueMap[val] = optionValue.id;
            }
        }

        // 7. Create variants
        for (const variant of variants) {
            let variantSku;
            let skuExists = true;
            while (skuExists) {
                variantSku = generateSKU(name, variant.option_values);
                skuExists = await db.ProductVariant.findOne({ where: { sku: variantSku } });
            }

            const newVariant = await db.ProductVariant.create({
                product_id: product.id,
                variant_name: variant.variant_name,
                sku: variantSku,
                price: variant.price,
                stock_quantity: variant.stock_quantity,
                created_by: userUid,
                updated_by: userUid
            }, { transaction: t });

            // link variant ↔ option values
            if (variant.option_values && variant.option_values.length) {
                const optionValueIds = variant.option_values.map(val => optionValueMap[val]);
                await newVariant.addOption_values(optionValueIds, { transaction: t });
            }
        }

        await t.commit();

        // Return product with associations
        const fullProduct = await db.Product.findByPk(product.id, {
            include: [
                { model: db.Category, as: "category", attributes: ["id", "uid", "name"] },
                { model: db.Brand, as: "brand", attributes: ["id", "name", "slug"] },
                { model: db.ProductOption, as: "options", include: [{ model: db.ProductOptionValue, as: "values" }] },
                { model: db.ProductVariant, as: "variants", include: [{ model: db.ProductOptionValue, as: "option_values" }] }
            ]
        });

        console.log("======== Final Product With Associations ========");
        console.log(JSON.stringify(fullProduct, null, 2));

        return { success: true, message: "Product created successfully", data: fullProduct };

    } catch (error) {
        await t.rollback();
        console.error("Error creating product:", error);
        return { success: false, message: "Internal server error", error: error.message };
    }
}

async function addProductMedia(req) {
    const t = await db.sequelize.transaction();
    try {
        const { product_id } = req.params;
        const userUid = req.user?.uid;

        const product = await db.Product.findByPk(product_id);
        if (!product) {
            await t.rollback();
            return { success: false, error: "Product not found" };
        }

        const mediaFiles = [];

        if (req.files?.length) {
            for (const [index, file] of req.files.entries()) {
                console.log("Processing file:", file.originalname, "size", file.size);

                if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
                    await t.rollback();
                    return { success: false, error: "Invalid file type. Must be image or video." };
                }

                const uploadRes = await uploadToCloudinary(
                    file.buffer,
                    file.mimetype,
                    product_id,
                    file.originalname
                );

                mediaFiles.push({
                    name: Array.isArray(req.body.name)
                        ? req.body.name[index]
                        : (req.body.name || path.parse(file.originalname).name),
                    url: uploadRes.secure_url,
                    type: file.mimetype.startsWith("video/") ? "video" : "image",
                });
            }
        }

        if (!mediaFiles.length) {
            await t.rollback();
            return { success: false, error: "No media files provided" };
        }

        if (!mediaFiles.some(m => m.is_primary)) {
            mediaFiles[0].is_primary = true;
        }

        for (const media of mediaFiles) {
            await db.ProductMedia.create({
                product_id: product.id,
                name: media.name,
                url: media.url,
                type: media.type,
                is_primary: media.is_primary || false,
                created_by: userUid,
                updated_by: userUid,
            }, { transaction: t });
        }

        await t.commit();

        const fullProduct = await db.Product.findByPk(product.id, {
            include: [
                { model: db.Category, as: "category", attributes: ["id", "uid", "name"] },
                { model: db.Brand, as: "brand", attributes: ["id", "name", "slug"] },
                { model: db.ProductOption, as: "options", include: [{ model: db.ProductOptionValue, as: "values" }] },
                { model: db.ProductVariant, as: "variants", include: [{ model: db.ProductOptionValue, as: "option_values" }] },
                { model: db.ProductMedia, as: "images" },
            ],
        });

        return {
            success: true,
            message: "Media uploaded successfully",
            product: fullProduct,
        };
    } catch (error) {
        await t.rollback();
        console.error("Upload product media failed:", error);

        // ❌ Do not try to unlink temp files (no path in memoryStorage)

        return { success: false, error: "Server error", details: error.message };
    }
}




async function getAllProducts() {
    try {
        const products = await db.Product.findAll({
            include: [
                // Category
                {
                    model: db.Category,
                    as: "category",
                    attributes: ["id", "uid", "name", "description", "parent_id"],
                    include: [
                        {
                            model: db.Category,
                            as: "parent",
                            attributes: ["id", "uid", "name"],
                        },
                    ],
                },
                // Brand
                {
                    model: db.Brand,
                    as: "brand",
                    attributes: ["id", "name", "slug"],
                },
                // Options + Option Values
                {
                    model: db.ProductOption,
                    as: "options",
                    attributes: ["id", "uid", "name"],
                    include: [
                        {
                            model: db.ProductOptionValue,
                            as: "values",
                            attributes: ["id", "uid", "value"],
                        },
                    ],
                },
                // Variants + linked Option Values
                {
                    model: db.ProductVariant,
                    as: "variants",
                    attributes: ["id", "uid", "variant_name", "sku", "price", "stock_quantity"],
                    include: [
                        {
                            model: db.ProductOptionValue,
                            as: "option_values",
                            attributes: ["id", "uid", "value"],
                            through: { attributes: [] }, // hide join table
                        },
                    ],
                },
            ],
            order: [["id", "ASC"]],
        });

        return { success: true, message: "Products fetched successfully", data: products };
    } catch (error) {
        console.error("Error fetching products:", error);
        return { success: false, message: "Internal server error", error: error.message };
    }
}

async function getProductByUid(req, res) {
    try {
        const { uid } = req.params;

        const product = await db.Product.findOne({
            where: { uid },
            include: [
                // Category
                {
                    model: db.Category,
                    as: "category",
                    attributes: ["id", "uid", "name", "description", "parent_id"],
                    include: [
                        {
                            model: db.Category,
                            as: "parent",
                            attributes: ["id", "uid", "name"],
                        },
                    ],
                },
                // Brand
                {
                    model: db.Brand,
                    as: "brand",
                    attributes: ["id", "name", "slug"],
                },
                // Options + Option Values
                {
                    model: db.ProductOption,
                    as: "options",
                    attributes: ["id", "uid", "name"],
                    include: [
                        {
                            model: db.ProductOptionValue,
                            as: "values",
                            attributes: ["id", "uid", "value"],
                        },
                    ],
                },
                // Variants + linked Option Values
                {
                    model: db.ProductVariant,
                    as: "variants",
                    attributes: ["id", "uid", "variant_name", "sku", "price", "stock_quantity"],
                    include: [
                        {
                            model: db.ProductOptionValue,
                            as: "option_values",
                            attributes: ["id", "uid", "value"],
                            through: { attributes: [] }, // hide join table
                        },
                    ],
                },
            ],
        });

        if (!product) {
            return { success: false, message: "Product not found" };
        }

        return { success: true, message: "Product fetched successfully", data: product };

    } catch (error) {
        console.error("Error fetching product by uid:", error);
        return { success: false, message: "Internal server error", error: error.message };
    }
}

async function updateProduct(req) {

}

module.exports = {
    addProduct,
    getAllProducts,
    getProductByUid,
    addProductMedia
};
