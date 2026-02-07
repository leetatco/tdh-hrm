module.exports = {
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
			_,
			$
		} = util;
		let {
			uid,
			employee_id,
			attendance_ym_key
		} = data;

		let res = {
			code: 0,
			msg: 'success',
			data: {
				we: [],
				clothes: [],
				cost: []
			}
		};

		// 参数验证
		if (!attendance_ym_key) {
			res.code = -1;
			res.msg = 'attendance_ym_key参数不能为空';
			return res;
		}

		// 将参数转换为数组格式
		const employeeIds = Array.isArray(employee_id) ? employee_id : (employee_id ? [employee_id] : []);
		const attendanceYmKeys = Array.isArray(attendance_ym_key) ? attendance_ym_key : [attendance_ym_key];

		try {
			// 1. 查询水电费（需要特殊处理，因为empids是数组）
			if (employeeIds.length > 0 && attendanceYmKeys.length > 0) {
				// 由于empids是数组，需要使用$elemMatch或$in来查询
				const weRes = await vk.baseDao.getTableData({
					dbName: "hrm-salary-we",
					data: {
						pageIndex: 1,
						pageSize: -1,
						...data
					},
					whereJson: {
						empids: {
							$elemMatch: {
								$in: employeeIds
							}
						}, // empids数组中包含任意一个employee_id
						attendance_ym: {
							$in: attendanceYmKeys
						}
					}
				});

				if (weRes.code === 0 && weRes.rows && weRes.rows.length > 0) {
					// 内存分组汇总：需要按员工ID和月份分组计算分摊费用
					const groupedWe = {};

					weRes.rows.forEach(record => {
						const {
							empids,
							attendance_ym,
							share_cost
						} = record;
						const shareCostPerPerson = share_cost;

						// 遍历该记录中的所有员工ID
						empids.forEach(empId => {
							// 只处理在请求参数中的员工ID
							if (employeeIds.includes(empId)) {
								const key = `${empId}_${attendance_ym}`;
								if (!groupedWe[key]) {
									groupedWe[key] = {
										employee_id: empId,
										attendance_ym: attendance_ym,
										share_cost: 0
									};
								}
								groupedWe[key].share_cost += shareCostPerPerson;
							}
						});
					});

					// 转换为数组
					res.data.we = Object.values(groupedWe);
				}
			}

			// 2. 查询工衣费
			if (employeeIds.length > 0 && attendanceYmKeys.length > 0) {
				const clothesRes = await vk.baseDao.getTableData({
					dbName: "hrm-salary-clothes",
					data: {
						pageIndex: 1,
						pageSize: -1,
						...data
					},
					whereJson: {
						employee_id: {
							$in: employeeIds
						},
						attendance_ym: {
							$in: attendanceYmKeys
						}
					},
					foreignDB: [{
						dbName: "hrm-employees",
						localKey: "employee_id",
						foreignKey: "employee_id",
						as: "employees",
						limit: 1
					}, {
						dbName: "uni-id-users",
						localKey: "update_id",
						foreignKey: "_id",
						as: "users",
						limit: 1
					}]
				});

				if (clothesRes.code === 0) {
					res.data.clothes = clothesRes.rows || [];
				}
			}

			// 3. 查询人事费用
			if (employeeIds.length > 0 && attendanceYmKeys.length > 0) {
				const costRes = await vk.baseDao.getTableData({
					dbName: "hrm-salary-cost",
					data: {
						pageIndex: 1,
						pageSize: -1,
						...data
					},
					whereJson: {
						employee_id: {
							$in: employeeIds
						},
						attendance_ym: {
							$in: attendanceYmKeys
						}
					},
					foreignDB: [{
						dbName: "hrm-employees",
						localKey: "employee_id",
						foreignKey: "employee_id",
						as: "employees",
						limit: 1
					}, {
						dbName: "uni-id-users",
						localKey: "update_id",
						foreignKey: "_id",
						as: "users",
						limit: 1
					}]
				});

				if (costRes.code === 0) {
					res.data.cost = costRes.rows || [];
				}
			}

		} catch (error) {
			console.error('批量查询费用数据失败:', error);
			res.code = -2;
			res.msg = '查询失败: ' + error.message;
		}

		return res;
	}
};