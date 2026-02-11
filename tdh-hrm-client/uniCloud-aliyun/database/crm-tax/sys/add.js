module.exports = {
	/**
	 * 添加单条数据
	 * @url admin/crm/tax/sys/add 前端调用的url参数地址
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
			company_id,
			year,
			tax_rating,
			vat_rate,
			vat_paid_tax,
			vat_is_overdue,
			vat_is_tax_refund,
			corporate_tax_rate,
			corporate_paid_tax,
			corporate_is_overdue,
			corporate_is_tax_refund,
			personal_tax_rate,
			personal_paid_tax,
			personal_is_overdue,
			personal_is_tax_refund,
			total_paid_tax,
			total_is_overdue,
			total_is_tax_refund,
			update_date,
			updat_id
		} = data;
		// 参数验证开始
		
		
		// 参数验证结束
		let dbName = "crm-tax"; // 表名
		// 执行 数据库add 命令
		res.id = await vk.baseDao.add({
			dbName,
			dataJson: {
				company_id,
				year,
				tax_rating,
				vat_rate,
				vat_paid_tax,
				vat_is_overdue,
				vat_is_tax_refund,
				corporate_tax_rate,
				corporate_paid_tax,
				corporate_is_overdue,
				corporate_is_tax_refund,
				personal_tax_rate,
				personal_paid_tax,
				personal_is_overdue,
				personal_is_tax_refund,
				total_paid_tax,
				total_is_overdue,
				total_is_tax_refund,
				update_date,
				updat_id
			}
		});
		// 业务逻辑结束-----------------------------------------------------------
		return res;
	}
}
