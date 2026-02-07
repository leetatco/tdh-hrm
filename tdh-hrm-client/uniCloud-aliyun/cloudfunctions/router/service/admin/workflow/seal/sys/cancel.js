module.exports = {
	/**
	 * 取消用印申请
	 * @url admin/ebp/seal/cancel 前端调用的url参数地址
	 * data 请求参数 说明
	 * @params {String}         id         记录ID
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
		let now = Date.now();
		
		try {
			// 验证记录是否存在和权限
			let existingApp = await vk.baseDao.findById(dbName, data.id);
			if (!existingApp) {
				return { code: -1, msg: '申请记录不存在' };
			}
			
			// 权限验证：只能取消自己的待审批申请
			if (existingApp.applicant_id !== uid && !userInfo.role.includes('admin')) {
				return { code: -1, msg: '无权取消他人的申请' };
			}
			
			if (existingApp.status !== 'pending') {
				return { code: -1, msg: '只能取消待审批状态的申请' };
			}
			
			// 更新申请状态为已取消
			await vk.baseDao.updateById(dbName, data.id, {
				status: 'cancelled',
				current_task: '已取消',
				update_date: now
			});
			
			// 取消相关的任务
			await db.collection("ebp_bpmn_task")
				.where({
					application_id: data.id,
					status: 'pending'
				})
				.update({
					status: 'cancelled',
					complete_time: now
				});
			
			res.msg = '取消成功';
			
		} catch (error) {
			console.error('取消用印申请失败:', error);
			res.code = -1;
			res.msg = `取消失败: ${error.message}`;
		}
		
		// 业务逻辑结束-----------------------------------------------------------
		return res;
	}
}