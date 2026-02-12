"use strict";
const common_vendor = require("../../../../../../common/vendor.js");
function setCustomClientInfo(data) {
  if (Object.prototype.toString.call(data) !== "[object Object]") {
    console.warn("setCustomClientInfo(data)的参数data必须是一个对象");
    return;
  }
  common_vendor.tr.setCustomClientInfo({
    customInfo: data
  });
}
exports.setCustomClientInfo = setCustomClientInfo;
