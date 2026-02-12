module.exports = {
	/**
	 * 查询用印申请记录 分页
	 * @url admin/workflow/seal/pub/getList 前端调用的url参数地址
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
			form_type_code
		} = data;
		let res = {
			code: 0,
			msg: ''
		};
		
		console.log("userInfo:",userInfo);
		
		// 业务逻辑开始-----------------------------------------------------------
		let dbName = "bpmn-application-form"; // 表名改为 bpmn_application_form

		// 构建查询条件
		let whereJson = {
			form_type_code
		};

		// 添加申请人筛选条件（如果不是管理员，默认只能查看自己的申请）
		if (data.formData && data.formData.applicant_id) {
			whereJson.applicant_id = data.formData.applicant_id;
		} else if (!userInfo.role || !userInfo.role.includes('admin')) {
			// 非管理员只能查看自己的申请，使用 userInfo.username 作为申请人ID
			whereJson.applicant_id = userInfo.username;
		}

		// 添加用印类型筛选条件
		if (data.formData && data.formData["form_data.seal_type"]) {
			whereJson["form_data.seal_type"] = data.formData["form_data.seal_type"];
		}

		// 添加文件名称模糊搜索条件
		if (data.formData && data.formData["form_data.file_name"]) {
			whereJson["form_data.file_name"] = new RegExp(data.formData["form_data.file_name"], 'i');
		}

		// 添加状态筛选条件
		if (data.formData && data.formData.status) {
			whereJson.status = data.formData.status;
		}

		// 添加申请时间范围条件
		if (data.formData && data.formData.create_date) {
			let createDate = data.formData.create_date;
			if (Array.isArray(createDate) && createDate.length === 2) {
				whereJson.create_date = {
					$gte: createDate[0],
					$lte: createDate[1]
				};
			}
		}
		
		console.log("whereJson:", whereJson)


		try {
			res = await vk.baseDao.getTableData({
				dbName,
				data, // 传递分页参数
				whereJson,
				sortArr: [{
					name: 'create_date',
					type: 'desc'
				}],
				// 关联查询获取申请人详细信息
				getMain: false, // 设置为false以使用新的关联查询方式
				joins: [
					{
						dbName: "hrm-employees",
						localKey: "applicant_id", // ebp_application_form.applicant_id
						foreignKey: "employee_id", // hrm-employees.employee_id
						as: "applicant_info",
						limit: 1
					},
					{
						dbName: "hrm-departments", 
						localKey: "applicant_department_id", // ebp_application_form.applicant_department_id
						foreignKey: "department_id", // hrm-departments.department_id
						as: "department_info",
						limit: 1
					},
					{
						dbName: "hrm-positions",
						localKey: "applicant_position_id", // ebp_application_form.applicant_position_id
						foreignKey: "position_id", // hrm-positions.position_id
						as: "position_info", 
						limit: 1
					}
				]
			});

			// 处理返回数据，确保申请人姓名字段正确
			if (res.rows && res.rows.length > 0) {
				res.rows = res.rows.map(item => {
					// 如果关联查询到了申请人信息，使用关联的姓名，否则使用表中存储的姓名
					if (item.applicant_info && item.applicant_info.employee_name) {
						item.applicant_name = item.applicant_info.employee_name;
					} else if (!item.applicant_name && item.applicant_employee_name) {
						item.applicant_name = item.applicant_employee_name;
					}
					return item;
				});
			}

		} catch (error) {
			console.error('查询用印申请列表失败:', error);
			res.code = -1;
			res.msg = '查询失败';
		}

		// 业务逻辑结束-----------------------------------------------------------
		return res;
	}
};