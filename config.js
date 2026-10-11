/**
 * config.js (root shim)
 * ---------------------------------------------------------------------
 * Ratusan plugin di /plugins (yang diadaptasi dari proyek lain) meng-import
 * config lewat "../../config.js" atau "../../appConfig.js" relatif dari
 * plugins/<kategori>/file.js. Config asli bot ada di src/config.js — file
 * ini cuma re-export supaya path lama tetap jalan tanpa perlu edit
 * ratusan file satu-satu.
 * ---------------------------------------------------------------------
 */
module.exports = require('./src/config.js');
