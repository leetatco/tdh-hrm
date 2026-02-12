"use strict";
const common_vendor = require("../../../common/vendor.js");
let vk = common_vendor.index.vk;
const _sfc_main = {
  data() {
    return {};
  },
  onLoad(options) {
    vk = common_vendor.index.vk;
  },
  methods: {
    pageTo(url) {
      vk.navigateTo(url);
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o(($event) => $options.pageTo("../password/password")),
    b: common_vendor.o(($event) => $options.pageTo("../mobile/mobile")),
    c: common_vendor.o(($event) => $options.pageTo("../email/email")),
    d: common_vendor.o(($event) => $options.pageTo("../weixin/weixin")),
    e: common_vendor.o(($event) => $options.pageTo("../../db-test/db-test")),
    f: common_vendor.o(($event) => $options.pageTo("../util/util")),
    g: common_vendor.o(($event) => $options.pageTo("../univerify/univerify")),
    h: common_vendor.o(($event) => $options.pageTo("../../vk-vuex/vk-vuex")),
    i: common_vendor.o(($event) => $options.pageTo("../login/index/index")),
    j: common_vendor.o(($event) => _ctx.vk.navigateTo("../../plugs/lucky-draw/lucky-draw")),
    k: common_vendor.o(($event) => _ctx.vk.navigateTo("../../openapi/weixin/weixin")),
    l: common_vendor.o(($event) => _ctx.vk.navigateTo("../../openapi/qq/qq")),
    m: common_vendor.o(($event) => _ctx.vk.navigateTo("../../openapi/douyin/douyin")),
    n: common_vendor.o(($event) => _ctx.vk.navigateTo("../../openapi/alipay/alipay")),
    o: common_vendor.o(($event) => _ctx.vk.navigateTo("../../openapi/baidu/baidu"))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-941659c9"]]);
wx.createPage(MiniProgramPage);
