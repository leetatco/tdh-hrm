/**
 * 自定义过滤器 - 前置（支持多公司权限）
 */
module.exports = [{
	id: "customFilterCompany",
	// 可以扩展匹配更多需要公司过滤的云函数
	regExp: [
		"admin/hrm/employees/sys/getList",
		"admin/hrm/company/sys/getList",
		"admin/hrm/department/sys/getList",
		"admin/hrm/attendance/sys/approve/getList",
		"admin/hrm/attendance/sys/getList",
		"admin/hrm/salary/sys/getList",
		//主页面看板计算
		// "admin/hrm/employees/pub/getAges",
		// "admin/hrm/employees/pub/getCenters",
		// "admin/hrm/employees/pub/getContracts",
		// "admin/hrm/employees/pub/getEducationals",
		// "admin/hrm/employees/pub/getGenders",
		// "admin/hrm/employees/pub/getManages",
		// "admin/hrm/employees/pub/getProvinces",
		// "admin/hrm/employees/pub/getResignTotal",
		// "admin/hrm/employees/pub/getTotal"		
	],
	description: "按公司别进行查询（支持多公司）",
	index: 310,
	mode: "onActionExecuting",
	enable: true,
	main: async function(event, serviceRes) {
		let {
			data = {}, util, filterResponse
		} = event;
		let {
			vk,
			db,
			_
		} = util;
		let {
			uid,
			userInfo = {}
		} = filterResponse;

		try {
			// 获取用户角色
			const userRoles = userInfo.role;
			// 获取当前云函数路径和集合名
			const routerPath = event.routerPath || "";
			const collectionName = data.collection || "";
			let systemAdminRoles = [];

			//获取拦截云函数和不需拦截角色组
			const filterDetails = await vk.baseDao.select({
				dbName: "hrm-company-filter",
				getMain: true
			});

			if (filterDetails && filterDetails[0].roles && filterDetails[0].paths) {
				//中间件（过滤器）的regExp属性是在服务启动时加载并编译的，之后不会动态改变
				// this.regExp = filterDetails[0].paths;
				systemAdminRoles = filterDetails[0].roles;
			}

			console.log("companyFilter_info:", userInfo.username, {
				routerPath,
				collectionName,
				userRoles
			});

			// 获取用户角色可查公司信息
			const roleDetails = await vk.baseDao.select({
				dbName: "uni-id-roles",
				whereJson: {
					"role_id": _.in(userRoles)
				},
				getMain: true
			});

			// 系统管理员角色
			const isSystemAdmin = userRoles && userRoles.some(role =>
				!systemAdminRoles.includes(role)
			);

			// 系统管理员不过滤
			if (!isSystemAdmin) {
				return {
					code: 0,
					msg: "系统管理员，无需公司过滤"
				}
			}

			// 获取用户有权限的公司列表（支持多公司）,默认是本人公司别
			let employeeInfo = {};

			let res = await vk.callFunction({
				url: 'client/user/pub/isUser',
				title: '请求中...',
				data: {
					username: userInfo.username
				},
			});

			if (res && res.total > 0) {
				employeeInfo = res.rows[0].employeeInfo
			}

			// console.log("employeeInfo:", employeeInfo);

			let userCompanyIds = [];
			if (employeeInfo.company_id) {
				userCompanyIds.push(employeeInfo.company_id);
			}
			roleDetails.map(role => {
				if (vk.pubfn.isNotNull(role.company)) {
					role.company.map(companyid => {
						userCompanyIds.push(companyid)
					})
				}
			})

			if (userCompanyIds.length === 0) {
				return {
					code: -1,
					msg: "用户角色未分配公司权限，无法查询数据"
				}
			}

			// 处理查询条件
			let filterWhereJson = data.whereJson || {};

			filterWhereJson.company_id = _.in(userCompanyIds);

			// 添加公司过滤条件				
			data.company_ids = userCompanyIds;
			data.filterWhereJson = filterWhereJson;

			console.log("companyFilter: 应用公司过滤条件", {
				employeeInfo,
				userCompanyIds,
				filterWhereJson
			});

			return {
				code: 0,
				msg: "公司过滤条件已应用",
				userInfo: {
					uid: uid,
					companyIds: userCompanyIds,
					isSystemAdmin: isSystemAdmin,
					filterWhereJson,
					datas: data
				}
			}

		} catch (error) {
			console.error('自定义过滤器错误:', error);
			return {
				code: -1,
				msg: "过滤器执行错误: " + error.message
			}
		}
	}
}]