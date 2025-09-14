const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');
const config = require('./config');
const fs = require('fs');
const path = require('path');
const { options } = require('joi');


// module.exports = { adminquery, userquery };
const exported = { adminquery, userquery };

module.exports = exported;

initializeAdmin();
initializeUser();

async function initializeAdmin() {
    const { host, port, user, password, database } = config.admindatabase;

    // create db if not exists
    const connection = await mysql.createConnection({
        host, port, user, password, ssl: { ca: fs.readFileSync(path.join(__dirname, 'ca.pem')) }
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    await connection.end();

    console.log("Admin database checked/created:", database);
}

async function initializeUser() {
    const { host, port, user, password, database } = config.userdatabase;

    // create db if not exists
    const connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    await connection.end();

    // Sequelize instance for user DB
    const caCert = fs.readFileSync(path.join(__dirname, 'ca.pem'));
    const sequelize = new Sequelize(database, user, password, {
        host,
        port,
        dialect: 'mysql',
        dialectOptions: {
            ssl: {
                ca: [caCert]
            }
        },
        pool: {
            max: 5,
            min: 0,
            idle: 10000
        },
        logging: false
    });

    // import models
    const { roles, users, otp_codes, refresh_tokens, account_logs } = require("./modules/authModule/auth.model");

    const Role = roles(sequelize);
    const User = users(sequelize);
    const OtpCodes = otp_codes(sequelize);
    const RefreshTokens = refresh_tokens(sequelize);
    const AccountLogs = account_logs(sequelize);


    // associations
    User.belongsTo(Role, { foreignKey: 'role_name', targetKey: 'name' });
    Role.hasMany(User, { foreignKey: 'role_name', sourceKey: 'name' });

    OtpCodes.belongsTo(User, { foreignKey: 'user_id', targetKey: 'id' });
    User.hasMany(OtpCodes, { foreignKey: 'user_id', sourceKey: 'id' });

    RefreshTokens.belongsTo(User, { foreignKey: 'user_id', targetKey: 'id' });
    User.hasMany(RefreshTokens, { foreignKey: 'user_id', sourceKey: 'id' });

    AccountLogs.belongsTo(User, { foreignKey: 'user_id', targetKey: 'id' });
    User.hasMany(AccountLogs, { foreignKey: 'user_id', sourceKey: 'id' });


    const { categories, brands, products, product_variants, product_options, product_option_values, product_media, banners } = require('./modules/storeModule/store.db.model');


    const Banner = banners(sequelize);
    const Category = categories(sequelize);
    const Brand = brands(sequelize)
    const Product = products(sequelize);
    const ProductVariant = product_variants(sequelize);
    const ProductOptionValue = product_option_values(sequelize);
    const ProductOption = product_options(sequelize);
    const ProductMedia = product_media(sequelize);



    // Category ↔ Subcategories
    Category.belongsTo(Category, { foreignKey: 'parent_id', as: 'parent', onDelete: 'CASCADE' });
    Category.hasMany(Category, { foreignKey: 'parent_id', as: 'subcategories', onDelete: 'CASCADE' });

    // Product ↔ Category
    Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category', onDelete: 'CASCADE' });
    Category.hasMany(Product, { foreignKey: 'category_id', as: 'products', onDelete: 'CASCADE' });

    // Product ↔ Brand
    Product.belongsTo(Brand, { foreignKey: "brand_id", as: "brand", onDelete: 'CASCADE' });
    Brand.hasMany(Product, { foreignKey: "brand_id", as: "products", onDelete: 'CASCADE' });

    // ProductVariant ↔ Product
    ProductVariant.belongsTo(Product, { foreignKey: 'product_id', as: 'product', onDelete: 'CASCADE' });
    Product.hasMany(ProductVariant, { foreignKey: 'product_id', as: 'variants', onDelete: 'CASCADE' });

    // ProductVariant ↔ OptionValues (M:M through join table)
    ProductVariant.belongsToMany(ProductOptionValue, {
        through: 'variant_option_values',
        foreignKey: 'variant_id',
        otherKey: 'option_value_id',
        as: 'option_values'
    });
    ProductOptionValue.belongsToMany(ProductVariant, {
        through: 'variant_option_values',
        foreignKey: 'option_value_id',
        otherKey: 'variant_id',
        as: 'variants'
    });

    // Product ↔ Options
    ProductOption.belongsTo(Product, { foreignKey: 'product_id', as: 'product', onDelete: 'CASCADE' });
    Product.hasMany(ProductOption, { foreignKey: 'product_id', as: 'options', onDelete: 'CASCADE' });

    // Option ↔ OptionValues
    ProductOption.hasMany(ProductOptionValue, { foreignKey: 'option_id', as: 'values', onDelete: 'CASCADE' });
    ProductOptionValue.belongsTo(ProductOption, { foreignKey: 'option_id', as: 'option', onDelete: 'CASCADE' });

    // Product ↔ Images
    Product.hasMany(ProductMedia, { foreignKey: "product_id", as: "images", onDelete: "CASCADE" });
    ProductMedia.belongsTo(Product, { foreignKey: "product_id", as: "product" });






    await sequelize.sync();

    const count = await Role.count();
    if (count === 0) {
        await Role.bulkCreate([
            { name: 'admin', description: 'Full access to manage platform' },
            { name: 'customer', description: 'Can browse and purchase products' },
            { name: 'seller', description: 'Can list & add, and sell products' },
            { name: 'delivery', description: 'Handles deliveries' },
            { name: 'support', description: 'Customer support staff' }
        ]);
        console.log("Default roles inserted into user DB");
    }

    // export models
    exported.Role = Role;
    exported.User = User;
    exported.OtpCodes = OtpCodes;
    exported.RefreshTokens = RefreshTokens;
    exported.AccountLogs = AccountLogs;
    exported.Category = Category;
    exported.Brand = Brand;
    exported.Product = Product;
    exported.ProductOption = ProductOption;
    exported.ProductVariant = ProductVariant;
    exported.ProductOptionValue = ProductOptionValue;
    exported.ProductMedia = ProductMedia;
    exported.Banner = Banner;


    exported.sequelize = sequelize;

    console.log("User database initialized with auth tables:", database);
}

// ---------- raw query helpers ----------
async function adminquery(sql, params) {
    const connection = await mysql.createConnection(config.admindatabase);
    const [results] = await connection.execute(sql, params);
    await connection.end();
    return results;
}

async function userquery(sql, params) {
    const connection = await mysql.createConnection(config.userdatabase);
    const [results] = await connection.execute(sql, params);
    await connection.end();
    return results;
}
