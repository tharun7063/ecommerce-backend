// utils/uid.js
const { v4: uuidv4 } = require('uuid');

module.exports = {
    generateUid
};

function generateUid() {
    return uuidv4();
}
