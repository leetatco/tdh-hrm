"use strict";
const common_vendor = require("../../../../../../common/vendor.js");
let importObject = function(name, importObjectOptions = {}) {
  const newObj = new Proxy(importObject, {
    get: function(target, key, receiver) {
      return async function(options = {}) {
        if (importObjectOptions.easy) {
          options = {
            data: options
          };
        }
        if (importObjectOptions.data) {
          if (typeof importObjectOptions.data === "function") {
            options.data = Object.assign({}, importObjectOptions.data(), options.data);
          } else {
            options.data = Object.assign({}, importObjectOptions.data, options.data);
          }
        }
        return common_vendor.index.vk.callFunction({
          ...importObjectOptions,
          ...options,
          url: `${name}.${key}`
        });
      };
    }
    // set: function(target, key, value, receiver) {
    // 	console.log("set");
    // 	console.log("target",target);
    // 	console.log("key",key);
    // 	console.log("value",value);
    // 	console.log("receiver", receiver);
    // },
  });
  return newObj;
};
exports.importObject = importObject;
