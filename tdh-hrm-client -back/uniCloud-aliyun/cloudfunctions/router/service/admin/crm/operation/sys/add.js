module.exports = {
	/**
	 * 添加单条数据
	 * @url admin/crm/operation/sys/add 前端调用的url参数地址
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
			next_year_business_intro,
			fixed_asset_investment,
			current_year_business_intro,
			top2_customer_revenue,
			external_account,
			internal_account,
			operating_revenue,
			net_profit,
			new_financing_needs,
			is_upstream_downstream,
			investment_amount_ratio,
			planned_investment,
			funding_source_intro,
			business_introduction,
			update_date,
			updat_id
		} = data;
		// 参数验证开始
		
		
		// 参数验证结束
		let dbName = "crm-company-operation"; // 表名
		// 执行 数据库add 命令
		res.id = await vk.baseDao.add({
			dbName,
			dataJson: {
				company_id,
				year,
				next_year_business_intro,
				fixed_asset_investment,
				current_year_business_intro,
				top2_customer_revenue,
				external_account,
				internal_account,
				operating_revenue,
				net_profit,
				new_financing_needs,
				is_upstream_downstream,
				investment_amount_ratio,
				planned_investment,
				funding_source_intro,
				business_introduction,
				update_id: uid,
								update_date: new Date().getTime()
			}
		});
		// 业务逻辑结束-----------------------------------------------------------
		return res;
	}
}
