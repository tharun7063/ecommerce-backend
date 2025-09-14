// routes/wishlist.controller.js
const express = require("express");
const router = express.Router();
const wishlistService  = require("./wishlist.service");
const auth = require('../../../middleware/authMiddleware')

// POST /api/wishlist/add
router.post("/add", auth.authenticate, wishlistService.addToWishlist);
router.delete("/:uid", auth.authenticate, wishlistService.removeFromWishlist);
router.get("/:user_id", auth.authenticate, wishlistService.getWishlist);


module.exports = router;
