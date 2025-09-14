const { DataTypes } = require('sequelize');
const { generateUid } = require('../../utils/uid');
const { types } = require('joi');



module.exports = {
    roles,
    users,
    otp_codes,
    refresh_tokens,
    account_logs
};



function roles(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        uid: { type: DataTypes.STRING(64), unique: true, defaultValue: () => generateUid() },
        name: {
            // type: DataTypes.ENUM('admin', 'customer', 'seller', 'delivery', 'support'),
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        description: { type: DataTypes.STRING(100) }
    };

    return sequelize.define('roles', attributes, {
        tableName: 'roles',
        timestamps: false
    });
}

function users(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        uid: { type: DataTypes.STRING(64), unique: true, defaultValue: () => generateUid() },
        auth_type: { type: DataTypes.ENUM("email", "mobile"), allowNull: false },
        password_hash: { type: DataTypes.STRING(255), allowNull: false },
        email: { type: DataTypes.STRING(100), unique: true, allowNull: true },
        country_code: { type: DataTypes.STRING(8), allowNull: true },
        phone_number: { type: DataTypes.STRING(20), unique: true, allowNull: true },
        role_name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "customer",
            references: { model: 'roles', key: 'name' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
        },
        is_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
        email_verify: { type: DataTypes.DATE },
        mobile_verify: { type: DataTypes.DATE },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    };

    return sequelize.define('users', attributes, {
        tableName: 'users',
        timestamps: false,
        indexes: [
            { unique: true, fields: ["email"] },
            { unique: true, fields: ["country_code", "phone_number"] }
        ]
    });
}

function otp_codes(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE'
        },
        otp: { type: DataTypes.STRING(6), allowNull: false },
        action_type: { type: DataTypes.ENUM("sign_up", "sign_in") },
        is_verified: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
        attempts: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, allowNull: false }
    };

    return sequelize.define("otp_codes", attributes, {
        tableName: 'otp_codes',
        timestamps: false
    });
}

function refresh_tokens(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE'
        },

        device_id: { type: DataTypes.STRING(128), allowNull: false },
        device_type: {
            type: DataTypes.ENUM("MOBILE", "TABLET", "DESKTOP", "WEB"),
            allowNull: false
        },

        token: { type: DataTypes.STRING(512), allowNull: true },
        created_by_ip: { type: DataTypes.STRING(45) },
        revoked_by_ip: { type: DataTypes.STRING(45) },

        is_revoked: { type: DataTypes.BOOLEAN, defaultValue: false },
        revoked_at: { type: DataTypes.DATE },
        expires_at: { type: DataTypes.DATE, allowNull: false },

        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        replaced_by_token: { type: DataTypes.STRING(512) },
    };
    return sequelize.define('refresh_tokens', attributes, {
        tableName: "refresh_tokens",
        timestamps: false
    });

}

function account_logs(sequelize) {
    const attributes = {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE'
        },
        action: { type: DataTypes.STRING(50), allowNull: false },
        ip_address: { type: DataTypes.STRING(45), allowNull: true },
        device_info: { type: DataTypes.STRING(255), allowNull: true },
        location: { type: DataTypes.STRING(255), allowNull: true },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    };

    return sequelize.define('account_logs', attributes, {
        tableName: 'account_logs',
        timestamps: false
    }
    )
}

