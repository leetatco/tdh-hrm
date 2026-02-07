"use strict";
const storage = {};
storage.setSessionStorageSync = function(key, data = "") {
  console.warn("非H5环境不支持此API");
};
storage.getSessionStorageSync = function(key) {
  console.warn("非H5环境不支持此API");
};
storage.removeSessionStorageSync = function(key) {
  console.warn("非H5环境不支持此API");
};
storage.clearSessionStorageSync = function(key) {
  console.warn("非H5环境不支持此API");
};
exports.storage = storage;
