module.exports = {
	/**
	 * 查询多条记录 分页
	 * @url admin/hrm/attendance/sys/approve/getList 前端调用的url参数地址
	 * data 请求参数 说明
	 * @params {Number}         pageIndex 当前页码
	 * @params {Number}         pageSize  每页显示数量
	 * @params {Array<Object>}  sortRule  排序规则
	 * @params {object}         formData  查询条件数据源
	 * @params {Array<Object>}  columns   查询条件规则
	 * res 返回参数说明
	 * @params {Number}         code      错误码，0表示成功
	 * @params {String}         msg       详细信息
	 */
	main: async (event) => {
		let {
			data = {}, userInfo, util, filterResponse, originalParam
		} = event;
		let {
			customUtil,
			uniID,
			config,
			pubFun,
			vk,
			db,
			_
		} = util;
		let {
			uid,
			attendance_ym,
			enable_hr
		} = data;
		let res = {
			code: 0,
			msg: ''
		};

		// 设置 pageSize 为 -1 获取所有记录（不分页）
		data.pageSize = -1;
		data.pageIndex = 1;
		// 业务逻辑开始-----------------------------------------------------------
		let dbName = "hrm-attendance-approve"; // 表名
		res = await vk.baseDao.getTableData({
			dbName,
			data,
			whereJson: {
				attendance_ym,
				enable_hr
			},
			// 副表
			foreignDB: [{
					dbName: "hrm-employees",
					localKey: "employee_id",
					foreignKey: "employee_id",
					as: "employees",
					limit: 1,
					foreignDB: [{
							dbName: "hrm-positions",
							localKey: "position_id",
							foreignKey: "position_id",
							as: "positions",
							limit: 1
						},
						{
							dbName: "hrm-resigntypes",
							localKey: "type_id",
							foreignKey: "type_id",
							as: "resigntypes",
							limit: 1
						},
						{
							dbName: "hrm-companys",
							localKey: "company_id",
							foreignKey: "company_id",
							as: "companys",
							limit: 1
						},
						{
							dbName: "hrm-departments",
							localKey: "department_id",
							foreignKey: "department_id",
							as: "departments",
							limit: 1
						}
					],
				}, {
					dbName: "uni-id-users",
					localKey: "update_id",
					foreignKey: "_id",
					as: "users",
					limit: 1
				},
				//定薪表
				{
					dbName: "hrm-salary-employees",
					localKey: "employee_id",
					foreignKey: "employee_id",
					as: "salarys",
					limit: 1
				},
				// //放假补助
				// {
				// 	dbName: "hrm-salary-free",
				// 	localKey: "employee_id",
				// 	foreignKey: "employee_id",
				// 	whereJson: {
				// 		attendance_ym
				// 	},
				// 	as: "frees",
				// 	limit: 1
				// },
				// //代扣社保
				// {
				// 	dbName: "hrm-salary-sb",
				// 	localKey: "employee_id",
				// 	foreignKey: "employee_id",
				// 	whereJson: {
				// 		attendance_ym
				// 	},
				// 	as: "sbs",
				// 	limit: 1
				// },
				// //代扣个税
				// {
				// 	dbName: "hrm-salary-gs",
				// 	localKey: "employee_id",
				// 	foreignKey: "employee_id",
				// 	whereJson: {
				// 		attendance_ym
				// 	},
				// 	as: "gss",
				// 	limit: 1
				// },
				// //借款
				// {
				// 	dbName: "hrm-salary-loan",
				// 	localKey: "employee_id",
				// 	foreignKey: "employee_id",
				// 	whereJson: {
				// 		attendance_ym
				// 	},
				// 	as: "loans",
				// 	limit: 1
				// },
				// //公司社保
				// {
				// 	dbName: "hrm-salary-companysb",
				// 	localKey: "employee_id",
				// 	foreignKey: "employee_id",
				// 	whereJson: {
				// 		attendance_ym
				// 	},
				// 	as: "companysbs",
				// 	limit: 1
				// },
			]
		});
		return res;
	}

}