const bannerService = require("./banners.service");
const auth = require('../../../middleware/authMiddleware');
const express = require('express');
const router = express.Router();
const multer = require("multer");
const upload = multer();




async function createBanner(req, res) {
    const result = await bannerService.createBanner(req);

    if (result?.success === false) {
        return res.status(400).json(result);
    }

    return res.status(201).json(result);
}

async function getAllBanners(req, res) {
    try {
        const result = await bannerService.getAllBanners();
        return res.status(200).json(result);
    } catch (err) {
        console.error("Error in getAllProducts:", err);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
}



router.post("/create", auth.authenticate, auth.authorizeAdminOnly, upload.single("file"), createBanner
);

router.get('/', getAllBanners)
module.exports = router;
