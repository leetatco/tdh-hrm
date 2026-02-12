"use strict";
const common_vendor = require("../vendor.js");
let myfn = {};
myfn.toDate = function(serial) {
  common_vendor.index.vk;
  let utcDate = new Date(Date.UTC(1900, 0, serial - 1));
  return utcDate.toISOString().slice(0, 10);
};
exports.myfn = myfn;
