// cloudfunctions/admin/bpmn/process-route-config/getProcessDefinitions/index.js
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
			let dbName = "bpmn-definition"; // 表名
			res = await vk.baseDao.getTableData({
				dbName,				
				whereJson: {
					status: "active"
				},
				fieldJson: {
					_id: true,
					name: true,
					key: true,
					description: true,
					category: true,
				}				
			});
		} catch (error) {
			console.error('获取流程定义失败:', error);
			res.code = -1;
			res.msg = `获取失败: ${error.message}`;
		}

		return res;
	}
};