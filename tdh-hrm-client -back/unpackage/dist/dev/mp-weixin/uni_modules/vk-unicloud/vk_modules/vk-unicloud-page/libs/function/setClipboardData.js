"use strict";
const common_vendor = require("../../../../../../common/vendor.js");
function setClipboardData(obj = {}) {
  common_vendor.index.setClipboardData({
    ...obj
  });
}
exports.setClipboardData = setClipboardData;
