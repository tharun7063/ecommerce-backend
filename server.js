const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const auth = require('./middleware/authMiddleware')


const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Routes
app.use('/auth', require('./modules/authModule/auth.controller'));
app.use('/category', auth.authenticate, auth.authorizeAdminOnly, require('./modules/storeModule/categories/category.controller'));
app.use('/brand', require('./modules/storeModule/brands/brand.controller'));
app.use('/product', require('./modules/storeModule/products/product.controller'));
app.use('/banner', require('./modules/storeModule/banners/banners.controller'));
app.use('/wishlist', require('./modules/storeModule/wishlist/wishlist.controller'));

// Global error handler (must come after routes)
app.use((err, req, res, next) => {
    console.error("Error caught by middleware:", err);

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Something went wrong",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
