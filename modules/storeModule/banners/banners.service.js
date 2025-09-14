const db = require("../../../db");
const cloudinary = require("cloudinary").v2;
const config = require("../../../config.json");

cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
});

// helper: promisify cloudinary upload
function uploadToCloudinary(fileBuffer, folder = "banners") {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: "auto", folder },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        stream.end(fileBuffer);
    });
}

async function createBanner(req) {
    try {
        const { title, description, link_url, start_date, end_date, discount } = req.body;

        if (!title) {
            return { success: false, message: "Title is required" };
        }
        if (!req.file) {
            return { success: false, message: "Image file is required" };
        }

        // Upload file to cloudinary
        const uploadResult = await uploadToCloudinary(req.file.buffer, "banners");

        // Save in DB
        const banner = await db.Banner.create({
            title,
            description,
            link_url,
            image_url: uploadResult.secure_url,
            start_date,
            end_date,
            discount,
        });

        return { success: true, data: banner };
    } catch (error) {
        console.error("Banner service error:", error);
        return { success: false, message: error.message };
    }
}

async function getAllBanners() {
    try {
        const banners = await db.Banner.findAll({
            order: [["created_at", "DESC"]],
        });

        return { success: true, data: banners };
    } catch (error) {
        console.error("Get banners error:", error);
        return { success: false, message: error.message };
    }
}

module.exports = {
    createBanner,
    getAllBanners
};
