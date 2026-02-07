"use strict";
const common_vendor = require("../../../common/vendor.js");
let vk = common_vendor.index.vk;
const _sfc_main = {
  data() {
    return {
      activity_id: "685b95a6e9f982fde4835c85"
      // 活动ID，具体活动ID请在vk-admin后台-系统设置-抽奖活动中查看，如有疑问，可联系QQ：370725567
    };
  },
  onLoad(options) {
    vk = common_vendor.index.vk;
  },
  methods: {
    navigateToLuckyDraw(path) {
      vk.navigateToLuckyDraw({
        path
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.o(($event) => $options.navigateToLuckyDraw(`pages/activity/detail/detail?_id=${$data.activity_id}`)),
    b: common_vendor.o(($event) => $options.navigateToLuckyDraw(`pages/activity/user-list/user-list?_id=${$data.activity_id}`)),
    c: common_vendor.o(($event) => $options.navigateToLuckyDraw(`pages/activity/win-user-list/win-user-list?_id=${$data.activity_id}`)),
    d: common_vendor.o(($event) => $options.navigateToLuckyDraw(`pages/activity/share/share?_id=${$data.activity_id}`)),
    e: common_vendor.o(($event) => $options.navigateToLuckyDraw("pages/index/add")),
    f: common_vendor.o(($event) => $options.navigateToLuckyDraw("pages/user/my-add/list")),
    g: common_vendor.o(($event) => $options.navigateToLuckyDraw("pages/user/my-in/list")),
    h: common_vendor.o(($event) => $options.navigateToLuckyDraw("pages/user/my-win/list")),
    i: common_vendor.o(($event) => $options.navigateToLuckyDraw("pages/index/mys")),
    j: common_vendor.o(($event) => $options.navigateToLuckyDraw("pages/index/index")),
    k: common_vendor.o(($event) => $options.navigateToLuckyDraw("pages/pub/help/index")),
    l: common_vendor.o(($event) => $options.navigateToLuckyDraw("pages/user/api-key/list"))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-28a10d68"]]);
wx.createPage(MiniProgramPage);
