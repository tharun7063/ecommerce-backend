// controllers/wishlistController.js
const db = require("../../../db")

async function addToWishlist(req, res) {
    try {
        const { user_id, product_id, variant_id } = req.body;

        if (!user_id || !product_id) {
            return res.status(400).json({ message: "user_id and product_id are required" });
        }

        // Check if the product is already in the wishlist
        const existing = await db.Wishlist.findOne({
            where: {
                user_id,
                product_id,
                variant_id: variant_id || null
            }
        });

        if (existing) {
            return res.status(200).json({ message: "Product already in wishlist", wishlist: existing });
        }

        // Add to wishlist
        const wishlistItem = await db.Wishlist.create({
            user_id,
            product_id,
            variant_id: variant_id || null,
            created_by: user_id,
            updated_by: user_id
        });

        return res.status(201).json({ message: "Added to wishlist", wishlist: wishlistItem });
    } catch (error) {
        console.error("Wishlist Error:", error);
        return res.status(500).json({ message: "Server error" });
    }
}

async function removeFromWishlist(req, res) {
    try {
        const { uid } = req.params;

        if (!uid) {
            return res.status(400).json({ message: "wishlist_uid is required" });
        }

        const deleted = await db.Wishlist.destroy({
            where: { uid }
        });

        if (!deleted) {
            return res.status(404).json({ message: "Wishlist item not found" });
        }

        return res.status(200).json({ message: "Removed from wishlist" });
    } catch (error) {
        console.error("Remove Wishlist Error:", error);
        return res.status(500).json({ message: "Server error" });
    }
}

async function getWishlist(req, res) {
    try {
        const { user_id } = req.params;

        if (!user_id) {
            return res.status(400).json({ message: "user_id is required" });
        }

        const wishlistItems = await db.Wishlist.findAll({
            where: { user_id },
            include: [
                {
                    model: db.Product,
                    as: "product",
                    include: [
                        { model: db.Brand, as: "brand", attributes: ["id", "name", "slug"] },
                        {
                            model: db.Category,
                            as: "category",
                            attributes: ["id", "name", "parent_id"],
                            include: [
                                { model: db.Category, as: "parent", attributes: ["id", "name"] },
                            ],
                        },
                        { model: db.ProductMedia, as: "images", attributes: ["id", "uid", "name", "product_id", "url", "type"] },
                        {
                            model: db.ProductVariant,
                            as: "variants",
                            include: [
                                { model: db.ProductOptionValue, as: "option_values", attributes: ["id", "uid", "value"], through: { attributes: [] } },
                            ],
                        },
                    ],
                },
                {
                    model: db.ProductVariant,
                    as: "variant",
                    include: [
                        { model: db.ProductOptionValue, as: "option_values", attributes: ["id", "uid", "value"], through: { attributes: [] } },
                    ],
                },
            ],
            order: [["created_at", "DESC"]],
        });

        return res.status(200).json({ success: true, count: wishlistItems.length, wishlist: wishlistItems });

    } catch (error) {
        console.error("Get Wishlist Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}


module.exports = { addToWishlist, removeFromWishlist, getWishlist };
