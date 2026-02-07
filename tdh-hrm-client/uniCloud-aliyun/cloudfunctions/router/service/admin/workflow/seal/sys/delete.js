module.exports = {
	/**
	 * 删除用印申请
	 * @url admin/ebp/seal/delete 前端调用的url参数地址
	 * data 请求参数 说明
	 * @params {String}         _id        记录ID
	 * res 返回参数说明
	 * @params {Number}         code       错误码，0表示成功
	 * @params {String}         msg        详细信息
	 */
	main: async (event) => {
		let { data = {}, userInfo, util, filterResponse, originalParam } = event;
		let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
		let { uid } = data;
		let res = { code: 0, msg: '' };
		// 业务逻辑开始-----------------------------------------------------------
		let dbName = "ebp_application_form"; // 表名
		
		try {
			// 验证记录是否存在和权限
			let existingApp = await vk.baseDao.findById(dbName, data._id);
			if (!existingApp) {
				return { code: -1, msg: '申请记录不存在' };
			}
			
			// 权限验证：只能删除自己的草稿
			if (existingApp.applicant_id !== uid && !userInfo.role.includes('admin')) {
				return { code: -1, msg: '无权删除他人的申请' };
			}
			
			if (existingApp.status !== 'draft') {
				return { code: -1, msg: '只能删除草稿状态的申请' };
			}
			
			// 执行删除
			await vk.baseDao.deleteById(dbName, data._id);
			res.msg = '删除成功';
			
		} catch (error) {
			console.error('删除用印申请失败:', error);
			res.code = -1;
			res.msg = `删除失败: ${error.message}`;
		}
		
		// 业务逻辑结束-----------------------------------------------------------
		return res;
	}
}