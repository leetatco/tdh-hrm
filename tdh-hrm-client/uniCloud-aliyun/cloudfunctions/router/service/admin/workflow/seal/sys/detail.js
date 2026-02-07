module.exports = {
	/**
	 * 获取单个用印申请详情
	 * @url admin/ebp/seal/get 前端调用的url参数地址
	 * data 请求参数 说明
	 * @params {String}         id         记录ID
	 * res 返回参数说明
	 * @params {Number}         code       错误码，0表示成功
	 * @params {String}         msg        详细信息
	 * @params {Object}         data       申请详情数据
	 */
	main: async (event) => {
		let { data = {}, userInfo, util, filterResponse, originalParam } = event;
		let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
		let { uid } = data;
		let res = { code: 0, msg: '' };
		// 业务逻辑开始-----------------------------------------------------------
		let dbName = "ebp_application_form"; // 表名
		
		try {
			// 获取申请详情
			let application = await vk.baseDao.findById(dbName, data.id);
			if (!application) {
				return { code: -1, msg: '申请记录不存在' };
			}
			
			// 权限验证：只能查看自己的申请或管理员
			if (application.applicant_id !== uid && !userInfo.role.includes('admin')) {
				return { code: -1, msg: '无权查看他人的申请' };
			}
			
			res.data = application;
			
		} catch (error) {
			console.error('获取用印申请详情失败:', error);
			res.code = -1;
			res.msg = `获取详情失败: ${error.message}`;
		}
		
		// 业务逻辑结束-----------------------------------------------------------
		return res;
	}
}