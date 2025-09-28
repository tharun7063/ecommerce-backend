// Modules/authModule/auth.service.js

const { where, NOW } = require('sequelize');
const config = require('../../config.json');
const db = require('../../db');
const nodemailer = require('nodemailer');
const { PassThrough } = require('nodemailer/lib/xoauth2');
const { date, attempt } = require('joi');
const { Op } = require('sequelize');
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fetch = require("node-fetch");
const bcrypt = require("bcrypt");



module.exports = {
    authenticateUser,
    authenticatePass,
    refreshToken,
    resendOtp,
    getAllUsers,
    getUserByUid,
}



async function generateOtp(action_type, otp_type, user) {
    // const otpCode = ("" + Math.floor(100000 + Math.random() * 900000)).substring(0, 6);
    const otpCode = "111111"
    const now = Date.now();
    const expiresAt = new Date(now + 3 * 60 * 1000);

    const durationMs = expiresAt - now;
    const totalSeconds = Math.floor(durationMs / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    const durationString = `${mins}:${secs < 10 ? '0' : ''}${secs} minutes`;  // "3:00 minutes"


    await db.OtpCodes.create({
        user_id: user.id,
        otp: otpCode,
        otp_type: otp_type,
        action_type: action_type,
        is_verified: false,
        attempts: 0,
        expires_at: expiresAt
    })

    return { otpCode, durationString };
}

async function sendOtptoEmail(otp, user, durationString) {

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,

        auth: {
            user: "soniq.music.dev@gmail.com",
            pass: "xpcexeslqlbdmgmp"
        }
    });

    // Email details
    const mailOptions = {
        from: '"E-commerce" <soniq.music.dev@gmail.com>',
        to: user.email,
        subject: "Your OTP Code",
        text: `Your OTP code is: ${otp}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f7f9fc;
      margin: 0; padding: 0;
    }
    .container {
      background-color: white;
      max-width: 600px;
      margin: 40px auto;
      padding: 30px 40px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      color: #333;
    }
    .header {
      font-size: 22px;
      font-weight: bold;
      margin-bottom: 20px;
      color: #2a9d8f;
    }
    .content {
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 30px;
    }
    .otp-code {
      font-size: 28px;
      font-weight: bold;
      letter-spacing: 4px;
      color: #e76f51;
      text-align: center;
      padding: 15px 0;
      border: 2px dashed #e76f51;
      border-radius: 6px;
      margin-bottom: 30px;
      user-select: all;
    }
    .footer {
      font-size: 14px;
      color: #999;
      text-align: center;
    }
    @media (max-width: 480px) {
      .container {
        padding: 20px 15px;
        margin: 20px auto;
      }
      .otp-code {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Your OTP Code</div>
    <div class="content">
      Hello,<br /><br />
      Thank you for using our service. To complete your action, please use the following One-Time Password (OTP):
    </div>
    <div class="otp-code">${otp}</div>
    <div class="content">
      This OTP is valid for <strong>${durationString} </strong>. Please do not share it with anyone.<br /><br />
      If you did not request this code, please ignore this email or contact support.
    </div>
    <div class="footer">
      &copy; 2025 SoniQ. All rights reserved. <br>
  <span style="color:#888; font-size:12px;">Please do not reply to this email. Replies are not monitored. </span>
    </div>
  </div>
</body>
</html>
`
    };

    // Send the email
    try {
        let info = await transporter.sendMail(mailOptions);
        // console.log('Email sent: %s', info.messageId);
        return true;
    } catch (err) {
        console.error('Error sending OTP email:', err);
        throw new Error("Failed to send OTP email");
    }
}

async function sendOtptoMobile(otp, user, durationString) {

}

function generateJwtToken(account) {
    return jwt.sign(
        { id: account.id, uid: account.uid, role: account.role_name },
        config.jwt_secret,
        { expiresIn: "15m" }
    );
}

async function generateRefreshToken(account, req) {
    const token = crypto.randomBytes(64).toString("hex");

    const refreshToken = await db.RefreshTokens.create({
        user_id: account.id,
        device_id: req.body.device_id,
        device_type: req.body.device_type,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_by_ip: req.ip
    });

    return token;
}

async function getLocationFromIP(ip) {
    try {

        // const res = await fetch(`http://ip-api.com/json/${ip}`);
        const res = await fetch(`https://ip-api.com/json/${ip}`);
        const data = await res.json();
        if (data.status === "success") {
            return `${data.city}, ${data.regionName}, ${data.country}`;
        }
    } catch (err) {
        console.error("IP lookup failed:", err.message);
    }
    return null;
}

async function logAccountAction({ userId, action, ip, deviceInfo }) {
    try {
        let location = null;
        if (ip && ip !== "::1" && ip !== "127.0.0.1") {
            location = await getLocationFromIP(ip);
        }

        await db.AccountLogs.create({
            user_id: userId,
            action,
            ip_address: ip || null,
            device_info: deviceInfo || null,
            location: location
        });
    } catch (err) {
        console.error("Failed to log account action:", err.message);
    }
}

async function resendOtp(req) {
    const auth_type = req.body.auth_type;
    let account = null;
    let user = {};
    let otp_type;

    // Find user by email or mobile
    if (auth_type === config.auth_types.email) {
        account = await db.User.findOne({ where: { email: req.body.email } });
    } else if (auth_type === config.auth_types.mobile) {
        account = await db.User.findOne({
            where: { country_code: req.body.countryCode, phone_number: req.body.mobile }
        });
    }

    if (!account) {
        throw new Error("Account not found");
    }

    // Only resend OTP if account is not yet verified
    if (account.is_verified) {
        throw new Error("Account already verified, OTP resend not allowed");
    }

    otp_type = auth_type === config.auth_types.email ? "email" : "mobile";

    // Generate a new OTP
    const { otpCode, durationString } = await generateOtp("sign_up", otp_type, account);

    // Send OTP via email or mobile
    if (otp_type === "email") {
        await sendOtptoEmail(otpCode, account, durationString);
        user.email = account.email;
    } else {
        await sendOtptoMobile(otpCode, account, durationString);
        user.countryCode = account.country_code;
        user.mobile = account.phone_number;
    }
    user.auth_type = "otp";

    return {
        success: true,
        message: "OTP resent successfully",
        duration: durationString,
        user
    };
}






async function authenticateUser(req) {
    const action = req.body.action;
    const auth_type = req.body.auth_type;
    const device_id = req.body.device_id;
    const device_type = req.body.device_type;
    const userAgent = req.get('user-agent');

    if (!action) return { success: false, message: "Action is required (sign_in or sign_up)" };

    let durationString = null;
    let account = null;
    let user = {};

    if (auth_type === config.auth_types.email) {
        const email = req.body.email;
        account = await db.User.findOne({ where: { email } });
        if (account) {
            user.email = account.email;
        }
    }
    else if (auth_type === config.auth_types.mobile) {
        const mobile = req.body.mobile;
        const countryCode = req.body.countryCode;
        account = await db.User.findOne({ where: { country_code: countryCode, phone_number: mobile } });
        if (account) {
            user.mobile = account.phone_number;
            user.countryCode = account.country_code;
        }
    }

    // ----------------- New Account Creation -----------------
    if (!account && action === "sign_up") {

        if (!req.body.password) {
            throw new Error("Password is required for new signup");
        }
        const passwordHash = await bcrypt.hash(req.body.password, 10);

        const newAccount = db.User.build({
            email: req.body.email || null,
            country_code: req.body.countryCode || null,
            phone_number: req.body.mobile || null,
            role_name: "customer",
            auth_type: auth_type,
            is_verified: false,
            password_hash: passwordHash
        });
        await newAccount.save();

        await logAccountAction({
            userId: newAccount.id,
            action: "sign_up",
            ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            deviceInfo: userAgent
        });

        // Send OTP if email/mobile
        let otp_type = auth_type === config.auth_types.email ? "email" : "mobile";
        const { otpCode, durationString: ds } = await generateOtp("sign_up", otp_type, newAccount);
        durationString = ds;

        if (auth_type === config.auth_types.email) {
            await sendOtptoEmail(otpCode, newAccount, durationString);
            user.email = newAccount.email;
        } else {
            await sendOtptoMobile(otpCode, newAccount, durationString);
            user.countryCode = newAccount.country_code;
            user.mobile = newAccount.phone_number;
        }
        user.auth_type = "otp";


        user.device_id = device_id;
        user.device_type = device_type;

        return {
            user,
            success: true,
            duration: durationString,
            message: "OTP sent successfully"
        };
    }

    // ----------------- Existing account but not verified -----------------
    if (account && !account.is_verified && action === "sign_up") {
        let otp_type = auth_type === config.auth_types.email ? "email" : "mobile";
        const { otpCode, durationString: ds } = await generateOtp("sign_up", otp_type, account);
        durationString = ds;

        if (auth_type === config.auth_types.email) {
            await sendOtptoEmail(otpCode, account, durationString);
            user.email = account.email;
        } else {
            await sendOtptoMobile(otpCode, account, durationString);
            user.countryCode = account.country_code;
            user.mobile = account.phone_number;
        }
        user.auth_type = "otp";

        await logAccountAction({
            userId: account.id,
            action: "sign_up",
            ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            deviceInfo: userAgent
        });

        user.device_id = device_id;
        user.device_type = device_type;

        return {
            user,
            success: true,
            duration: durationString,
            message: "OTP sent successfully"
        };
    }

    // ----------------- Verified account → login -----------------
    if (account && account.is_verified && action === "sign_in") {
        if (!req.body.password) {
            throw new Error("Password required for login");
        }

        const validPassword = await bcrypt.compare(req.body.password, account.password_hash);
        if (!validPassword) {
            return { success: false, message: "Invalid email/mobile or password" };
        }

        const jwt_token = generateJwtToken(account);
        const refresh_token = await generateRefreshToken(account, req);


        await logAccountAction({
            userId: account.id,
            action: "sign_in",
            ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            deviceInfo: userAgent
        });

        user.device_id = device_id;
        user.device_type = device_type;

        const safeUser = account.toJSON();
        delete safeUser.password_hash;

        return {
            success: true,
            user: safeUser,
            jwt_token,
            refresh_token
        };
    }

    if (account && !account.is_verified && action === "sign_in") {
        return {
            success: false,
            message: "Account exists but is not verified. Please verify using the OTP sent."
        };
    }

    // ----------------- No account + trying to sign_in -----------------
    if (!account && action === "sign_in") {
        return {
            success: false,
            message: "Account does not exist. Please sign up first."
        };
    }

    if (account && account.is_verified && action === "sign_up") {
        return {
            success: false,
            message: "Account already exist. Please login..."
        };
    }

}

async function authenticatePass(req, res) {
    try {
        const auth_type = req.body.auth_type;
        const device_id = req.body.device_id;
        const device_type = req.body.device_type;
        let account = null;
        const userAgent = req.get('user-agent');

        // 1. Find account
        if (auth_type === config.auth_types.email) {
            account = await db.User.findOne({ where: { email: req.body.email } });
        } else if (auth_type === config.auth_types.mobile) {
            account = await db.User.findOne({ where: { phone_number: req.body.mobile, country_code: req.body.countryCode } });
        }

        if (!account) {
            return { success: false, errorCode: 404, message: "Account not found" };
        }

        // 2. Verify OTP
        const submittedOtp = req.body.otp;
        if (!submittedOtp) {
            return { success: false, errorCode: 400, message: "OTP is required" };
        }

        const otpRecord = await db.OtpCodes.findOne({
            where: {
                user_id: account.id,
                otp: submittedOtp,
                is_verified: false,
                expires_at: { [Op.gt]: new Date() }
            }
        });

        if (!otpRecord) {
            return { success: false, errorCode: 400, message: "Invalid or expired OTP" };
        }

        // OTP valid → mark verified
        otpRecord.is_verified = true;
        otpRecord.attempts += 1;
        await otpRecord.save();

        if (!account.is_verified) {
            account.is_verified = true;
            account.updated_at = new Date();
            if (auth_type === "email") account.email_verify = new Date();
            if (auth_type === "mobile") account.mobile_verify = new Date();
            await account.save();
        }

        const jwt_token = generateJwtToken(account);
        const refresh_token = await generateRefreshToken(account, req);

        const safeUser = account.toJSON();
        delete safeUser.password_hash;

        return {
            success: true,
            user: safeUser,
            jwt_token,
            refresh_token
        };

    } catch (err) {
        console.error("Auth error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

// Fetch all users
async function getAllUsers(req, res) {
  try {
    const users = await db.User.findAll({
      attributes: { exclude: ['password_hash'] },
    });
    return res.status(200).json({ success: true, users });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// Fetch single user by UID
async function getUserByUid(req, res) {
  try {
    const { uid } = req.params;

    const user = await db.User.findOne({
      where: { uid },
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error("Error fetching user:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}



// async function authenticatePass(req) {
//     const auth_type = req.body.auth_type;
//     let account = null;
//     // let passValid = false;
//     const userAgent = req.get('user-agent');


//     if (auth_type === config.auth_types.email) {
//         const email = req.body.email;
//         account = await db.User.findOne({ where: { email } });

//     } else if (auth_type === config.auth_types.mobile) {
//         const mobile = req.body.mobile;
//         const countryCode = req.body.countryCode;
//         account = await db.User.findOne({ where: { phone_number: mobile, country_code: countryCode } });

//     }

//     if (!account) {
//         throw new Error("Account not found");
//     }

//     const submittedOtp = req.body.otp;
//     if (!submittedOtp) {
//         throw new Error("OTP is required")
//     }

//     const otpRecord = await db.OtpCodes.findOne({
//         where: {
//             user_id: account.id,
//             otp: submittedOtp,
//             is_verified: false,
//             expires_at: { [Op.gt]: new Date() }
//         }
//     });

//     if (otpRecord) {
//         otpRecord.attempts += 1;
//         otpRecord.is_verified = true;
//         await otpRecord.save();
//     } else {
//         const expiredOtp = await db.OtpCodes.findOne({
//             where: {
//                 user_id: account.id,
//                 otp: submittedOtp,
//                 is_verified: false,
//                 expires_at: { [Op.lte]: new Date() }
//             }
//         });

//         if (expiredOtp) {
//             expiredOtp.attempts += 1;
//             await expiredOtp.save();
//             throw new Error("Expired OTP");
//         } else {
//             const latestOtp = await db.OtpCodes.findOne({
//                 where: {
//                     user_id: account.id,
//                     is_verified: false,
//                     expires_at: { [Op.gt]: new Date() }
//                 },
//                 order: [['created_at', 'DESC']]
//             });
//             if (latestOtp) {
//                 latestOtp.attempts += 1;
//                 await latestOtp.save();
//             }
//             throw new Error("Invalid OTP");
//         }
//     }
//     if (!account.is_verified) {
//         account.is_verified = true;
//         account.updated_at = new Date();
//         if (auth_type === 'email') account.email_verify = new Date();
//         else if (auth_type === 'mobile') account.mobile_verify = new Date();
//         await account.save();
//     }
//     passValid = true;

//     if (passValid) {
//         const jwt_token = generateJwtToken(account);
//         const refresh_token = await generateRefreshToken(account, req);


//         await logAccountAction({
//             userId: account.id,
//             action: "sign_in",
//             ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
//             deviceInfo: userAgent
//         });

//         // Set refresh token in cookie
//         // res.cookie("refreshToken", refresh_token, {
//         //     httpOnly: true,
//         //     secure: true,
//         //     sameSite: "Strict",
//         //     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
//         // });

//         return {
//             success: true,
//             user: account,
//             jwt_token,
//             refresh_token
//         };
//     }
// }

async function refreshToken(req) {

    const { refreshToken, deviceId } = req.body;

    if (!refreshToken || !deviceId) {
        return { success: false, status: 400, message: "Missing refreshToken or deviceId" };
    }

    const tokenRow = await db.RefreshTokens.findOne({
        where: { token: refreshToken, device_id: deviceId, is_revoked: false }
    });

    if (!tokenRow || tokenRow.expires_at < new Date()) {
        return { success: false, status: 401, message: "Invalid or expired refresh token" };
    }

    // Always issue a new JWT
    const account = await db.User.findOne({ where: { id: tokenRow.user_id } });

    const newJwt = generateJwtToken(account);

    let newRefreshToken = null;
    const daysLeft = (tokenRow.expires_at - new Date()) / (1000 * 60 * 60 * 24);

    // Rotate refresh token if 2 days or less remain
    if (daysLeft <= 2) {
        newRefreshToken = crypto.randomBytes(64).toString("hex");

        tokenRow.is_revoked = true;
        tokenRow.revoked_at = new Date();
        tokenRow.replaced_by_token = newRefreshToken;
        await tokenRow.save();

        await db.RefreshTokens.create({
            user_id: tokenRow.user_id,
            device_id: deviceId,
            device_type: tokenRow.device_type,
            token: newRefreshToken,
            created_by_ip: req.ip,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
    }
    const safeUser = account.toJSON();
    delete safeUser.password_hash;

    const result = {
        success: true,
        account: safeUser,
        accessToken: newJwt,
        refreshToken: newRefreshToken
    };
    return result;
}

