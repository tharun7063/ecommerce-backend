const db = require('../../../db');

module.exports = {
    addBrand,
    getAllBrands
};

// Service
async function addBrand(req) {
    try {
        const userUid = req.user.uid;
        const input = Array.isArray(req.body) ? req.body : [req.body];

        const createdBrands = [];

        for (const brandData of input) {
            const { name, slug, description, logo_url } = brandData;

            const existingBrand = await db.Brand.findOne({ where: { slug } });
            if (existingBrand) {
                // skip or throw error — here I skip duplicates
                continue;
            }

            const brand = await db.Brand.create({
                name,
                slug,
                description,
                logo_url,
                status: true,
                created_by: userUid,
                updated_by: userUid
            });

            createdBrands.push(brand);
        }

        return {
            success: true,
            message: createdBrands.length > 1
                ? `${createdBrands.length} brands added successfully`
                : createdBrands.length === 1
                    ? "Brand added successfully"
                    : "No new brands added (all duplicates)",
            data: createdBrands
        };
    } catch (error) {
        console.error("Error adding brand:", error);
        return {
            success: false,
            message: "Something went wrong while adding brand",
            error: error.message,
        };
    }
}

async function getAllBrands() {
    try {
        const brands = await db.Brand.findAll();
        return {
            success: true,
            message: 'Brands fetched successfully',
            data: brands
        };
    } catch (error) {
        console.error("Error fetching brands:", error);
        return {
            success: false,
            message: "Internal server error",
            error: error.message
        };
    }
}

