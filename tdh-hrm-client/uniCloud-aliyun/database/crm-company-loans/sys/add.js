module.exports = {
	/**
	 * 添加单条数据
	 * @url admin/crm/loans/sys/add 前端调用的url参数地址
	 * data 请求参数 说明
	 * res 返回参数说明
	 * @params {Number} code 错误码，0表示成功
	 * @params {String} msg 详细信息
	 */
	main: async (event) => {
		let { data = {}, userInfo, util, filterResponse, originalParam } = event;
		let { customUtil, uniID, config, pubFun, vk, db, _ } = util;
		let { uid } = data;
		let res = { code: 0, msg: 'ok' };
		// 业务逻辑开始-----------------------------------------------------------
		// 获取前端传过来的参数
		let {
			loan_introduction_type,
			company_id,
			loan_bank,
			loan_type,
			loan_name,
			total_amount,
			pre_loan_period,
			loan_term,
			actual_amount,
			loan_time,
			annual_interest_rate,
			collateral,
			guarantor,
			is_overdue,
			subsidy_amount,
			monthly_repayment,
			other,
			update_date,
			updat_id
		} = data;
		// 参数验证开始
		
		
		// 参数验证结束
		let dbName = "crm-company-loans"; // 表名
		// 执行 数据库add 命令
		res.id = await vk.baseDao.add({
			dbName,
			dataJson: {
				loan_introduction_type,
				company_id,
				loan_bank,
				loan_type,
				loan_name,
				total_amount,
				pre_loan_period,
				loan_term,
				actual_amount,
				loan_time,
				annual_interest_rate,
				collateral,
				guarantor,
				is_overdue,
				subsidy_amount,
				monthly_repayment,
				other,
				update_date,
				updat_id
			}
		});
		// 业务逻辑结束-----------------------------------------------------------
		return res;
	}
}
