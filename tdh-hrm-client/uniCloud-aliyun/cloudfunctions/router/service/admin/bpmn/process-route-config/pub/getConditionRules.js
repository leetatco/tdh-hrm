// cloudfunctions/admin/bpmn/process-route-config/getConditionRules/index.js
module.exports = {
	main: async (event) => {
		let {
			util
		} = event;
		let {
			vk,
			db
		} = util;

		let res = {
			code: 0,
			msg: ''
		};

		try {
			let dbName = "bpmn-condition-rule"; // 表名
			res = await vk.baseDao.getTableData({
				dbName,				
				whereJson: {
					status: "active"
				},
				fieldJson: {
					_id: true,
					name: true,
					code: true,
					description: true
				}
			})

		} catch (error) {
			console.error('获取条件规则失败:', error);
			res.code = -1;
			res.msg = `获取失败: ${error.message}`;
		}

		return res;
	}
};