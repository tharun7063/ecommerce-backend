const config = require('../config.json')
const jwt = require('jsonwebtoken')
const db = require('../db');
const { where } = require('sequelize');

module.exports = {
    authenticate,
    authorizeAdminOnly,
    authorizeSellerOrAdmin
}

async function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "No token provided"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decode = jwt.verify(token, config.jwt_secret)
        const user = await db.User.findOne({
            where: decode.uid
                ? { uid: decode.uid }
                : { id: decode.id }
        })
        if (!user) {
            return res.status(401).json({ error: "Invalid token" });
        }
        req.user = user;
        next();
    } catch (err) {
        console.error("Auth error:", err);
        return res.status(403).json({ error: "Unauthorized: Invalid token" });
    }

};

async function authorizeAdminOnly(req, res, next) {
    if (req.user?.role_name !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
    }
    next();
}

async function authorizeSellerOrAdmin(req, res, next) {
    try {
        const role = req.user?.role_name;

        if (!role) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. User role not found."
            });
        }

        if (role !== "seller" && role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only sellers or admins are allowed."
            });
        }

        next();
    } catch (error) {
        console.error("Authorization error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error during authorization."
        });
    }
}
