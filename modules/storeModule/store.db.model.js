const { func, allow, attempt, string } = require('joi')
const { DataTypes } = require('sequelize')
const { generateUid } = require('../../utils/uid')
const { text } = require('express')
const { UPDATE } = require('sequelize/lib/query-types')


module.exports = {
    banners,
    categories,
    brands,
    products,
    product_variants,
    product_option_values,
    product_options,
    product_media,
    warehouses,
    inventory,
    addresses,
    shipping_methods,
    coupons,
    orders,
    order_items,
    payments,
    admin_logs,
    wishlists
}

function banners(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        uid: { type: DataTypes.STRING, allowNull: false, defaultValue: () => generateUid() },
        title: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.STRING, allowNull: false },
        link_url: { type: DataTypes.STRING, allowNull: true },
        image_url: { type: DataTypes.STRING, allowNull: false },
        start_date: { type: DataTypes.DATE, allowNull: true },
        end_date: { type: DataTypes.DATE, allowNull: true, },
        discount: { type: DataTypes.INTEGER, allowNull: true },

    }
    return sequelize.define('banners', attributes, {
        tableName: 'banners',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    })

}

function categories(sequelize) {
    const attributes = {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        uid: { type: DataTypes.STRING(64), unique: true, defaultValue: () => generateUid(), allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.STRING, allowNull: false, unique: true },
        parent_id: { type: DataTypes.BIGINT, defaultValue: null },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_by: { type: DataTypes.STRING(64), allowNull: false },
        updated_by: { type: DataTypes.STRING(64), allowNull: true }
    }
    return sequelize.define("categories", attributes, {
        tableName: "categories",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at"
    })
}

function brands(sequelize) {
    const attributes = {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        uid: {
            type: DataTypes.STRING(64),
            unique: true,
            defaultValue: () => generateUid(),
            allowNull: false
        },
        name: { type: DataTypes.STRING, allowNull: false },
        slug: { type: DataTypes.STRING, allowNull: false, unique: true },
        description: { type: DataTypes.STRING, allowNull: true },
        logo_url: { type: DataTypes.STRING, allowNull: true },
        status: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_by: { type: DataTypes.STRING(64), allowNull: false },
        updated_by: { type: DataTypes.STRING(64), allowNull: true }
    };

    return sequelize.define("brands", attributes, {
        tableName: "brands",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at"
    });
}

function products(sequelize) {
    return sequelize.define('products', {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        uid: { type: DataTypes.STRING(64), unique: true, defaultValue: () => generateUid(), allowNull: false },
        name: { type: DataTypes.STRING(255), allowNull: false },
        slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
        description: { type: DataTypes.TEXT, allowNull: false },
        short_description: { type: DataTypes.STRING(500), allowNull: true },
        price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        discount_price: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: null },
        sku: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        stock_quantity: { type: DataTypes.INTEGER, allowNull: false },
        status: { type: DataTypes.ENUM("active", "inactive", "draft"), allowNull: false, defaultValue: "active" },
        category_id: { type: DataTypes.BIGINT, allowNull: false },
        brand_id: { type: DataTypes.BIGINT, allowNull: false },
        created_by: { type: DataTypes.STRING(64), allowNull: false },
        updated_by: { type: DataTypes.STRING(64), allowNull: true }

    }, {
        tableName: 'products',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
}

function product_variants(sequelize) {
    return sequelize.define('product_variants', {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        uid: { type: DataTypes.STRING(64), unique: true, defaultValue: () => generateUid(), allowNull: false },
        product_id: { type: DataTypes.BIGINT, allowNull: false },
        variant_name: { type: DataTypes.STRING(200), allowNull: false },
        sku: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        stock_quantity: { type: DataTypes.INTEGER, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_by: { type: DataTypes.STRING(64), allowNull: false },
        updated_by: { type: DataTypes.STRING(64), allowNull: true }
    }, {
        tableName: 'product_variants',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
}

function product_options(sequelize) {
    return sequelize.define('product_options', {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        uid: { type: DataTypes.STRING(64), unique: true, defaultValue: () => generateUid(), allowNull: false },
        product_id: { type: DataTypes.BIGINT, allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_by: { type: DataTypes.STRING(64), allowNull: false },
        updated_by: { type: DataTypes.STRING(64), allowNull: true }
    }, {
        tableName: 'product_options',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
}

function product_option_values(sequelize) {
    return sequelize.define('product_option_values', {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        uid: { type: DataTypes.STRING(64), unique: true, defaultValue: () => generateUid(), allowNull: false },
        option_id: { type: DataTypes.BIGINT, allowNull: false },
        value: { type: DataTypes.STRING(100), allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_by: { type: DataTypes.STRING(64), allowNull: false },
        updated_by: { type: DataTypes.STRING(64), allowNull: true }
    }, {
        tableName: 'product_option_values',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
}

function product_media(sequelize) {
    const attributes = {
        id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
        uid: { type: DataTypes.STRING(64), unique: true, defaultValue: () => generateUid(), allowNull: false },
        product_id: { type: DataTypes.BIGINT, allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
        url: { type: DataTypes.STRING, allowNull: false },
        type: { type: DataTypes.ENUM('image', 'video'), allowNull: false },
        created_by: { type: DataTypes.STRING(64), allowNull: false },
        updated_by: { type: DataTypes.STRING(64), allowNull: true }
    };
    return sequelize.define('product_media', attributes, {
        tableName: 'product_media',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
}

function warehouses(sequelize) {

}

function inventory(sequelize) {

}

function addresses(sequelize) {

}

function shipping_methods(sequelize) {

}

function coupons(sequelize) {

}

function orders(sequelize) {

}

function order_items(sequelize) {

}

function payments(sequelize) {

}

function admin_logs(sequelize) {

}

function wishlists(sequelize) {
    const attributes = {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        uid: { type: DataTypes.STRING(64), unique: true, defaultValue: () => generateUid(), allowNull: false },
        user_id: { type: DataTypes.INTEGER, allowNull: false },
        product_id: { type: DataTypes.BIGINT, allowNull: false },
        variant_id: { type: DataTypes.BIGINT, allowNull: true },
        created_by: { type: DataTypes.STRING(64), allowNull: false },
        updated_by: { type: DataTypes.STRING(64), allowNull: true }
    };
    return sequelize.define('wishlists', attributes, {
        tableName: 'wishlists',
        timestamps: true,   
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
}

