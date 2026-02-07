// admin/workflow/seal/sys/add
const ProcessRouter = require('../../../../common/pub/class/process-router.js');
const HrmService = require('../../../../common/pub/class/hrm-service.js');
// 引入 bpmn.js
const bpmn = require('bpmn-js'); // 或者根据实际路径调整
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
			company_ids = [],
			attendance_ym
		} = data;
		let res = {
			code: 0,
			msg: ''
		};

		// 业务逻辑开始-----------------------------------------------------------
		let dbName = "bpmn-application-form";
		let now = Date.now();

		try {
			// 1. 获取员工完整信息
			const hrmService = new HrmService(vk, db);			
			const employeeInfo = await hrmService.getEmployeeInfoByUsername(userInfo.username);			

			// 2. 准备申请数据
			let applicationData = {
				form_type_code: "SEAL_APPLICATION",
				// 申请人信息 - 使用 userInfo.username 作为 applicant_id
				applicant_id: userInfo.username, // 使用 username 作为申请人ID
				applicant_name: employeeInfo.employee_name,
				// 员工信息
				applicant_employee_id: employeeInfo.employee_id,
				applicant_employee_name: employeeInfo.employee_name,
				// 部门信息
				applicant_department_id: employeeInfo.department_id,
				applicant_department_name: employeeInfo.department_name,
				applicant_department_code: employeeInfo.department_code,
				// 职位信息
				applicant_position_id: employeeInfo.position_id,
				applicant_position_name: employeeInfo.position_name,
				applicant_position_level: employeeInfo.position_level,
				// 公司信息
				applicant_company_id: employeeInfo.company_id,
				applicant_company_name: employeeInfo.company_name,
				// 申请内容
				title: `${data.form_data.file_name} - 用印申请`,
				form_data: data.form_data,
				update_date: now
			};

			// 3. 判断是添加还是更新
			if (data.id) {
				// 更新操作
				let existingApp = await vk.baseDao.findById({
					dbName,
					id: data.id
				});

				if (!existingApp) {
					return {
						code: -1,
						msg: '申请记录不存在'
					};
				}

				if (existingApp.applicant_id !== userInfo.username) {
					return {
						code: -1,
						msg: '无权修改他人的申请'
					};
				}

				if (existingApp.status !== 'draft') {
					return {
						code: -1,
						msg: '只能修改草稿状态的申请'
					};
				}

				applicationData.status = data.status || 'draft';
				applicationData.current_task = data.status === 'pending' ? '待选择流程' : '草稿';

				// 执行更新
				// await vk.baseDao.updateById({
				// 	dbName,
				// 	id: data.id,
				// 	dataJson: applicationData
				// });
				// res.msg = '更新成功';
				// res.data = {
				// 	id: data.id
				// };

				// 如果是提交审批，启动 BPMN 流程
				if (data.status === 'pending') {
					await startBPMNProcess(data.id, userInfo, applicationData, employeeInfo, vk, db);
				}
			} else {
				// 添加操作
				applicationData.create_date = now;
				applicationData.status = data.status || 'draft';
				applicationData.current_task = data.status === 'pending' ? '待选择流程' : '草稿';

				// 执行添加
				let addRes = await vk.baseDao.add({
					dbName,
					dataJson: applicationData
				});
				res.msg = data.status === 'pending' ? '提交成功' : '保存草稿成功';
				res.data = {
					id: addRes._id
				};

				// 如果是提交审批，启动 BPMN 流程
				if (data.status === 'pending') {
					await startBPMNProcess(addRes._id, userInfo, applicationData, employeeInfo, vk, db);
				}
			}

		} catch (error) {
			console.error('提交用印申请失败:', error);
			res.code = -1;
			res.msg = `提交失败: ${error.message}`;
		}

		return res;
	}
};

// 启动 BPMN 流程实例（完整集成 bpmn-instance, bpmn-task, bpmn-task-history）
async function startBPMNProcess(applicationId, userInfo, applicationData, employeeInfo, vk, db) {
	try {
		// 1. 使用路由引擎选择流程
		const router = new ProcessRouter(vk, db);
		const routeResult = await router.selectProcessForSeal(applicationData, employeeInfo);

		console.log('路由选择结果:', routeResult);
		
		 
		// 1. 再次检查 BPMN 引擎
		    if (!vk.bpmn) {
		      throw new Error('BPMN引擎未初始化');
		    }

		// 2. 构建流程变量
		const processVariables = {
			// 申请信息
			applicationId: applicationId,
			// 申请人信息 - 使用 userInfo.username
			applicantId: userInfo.username,
			applicantName: employeeInfo.employee_name,
			// 员工信息
			employeeId: employeeInfo.employee_id,
			employeeName: employeeInfo.employee_name,
			// 部门信息
			departmentId: employeeInfo.department_id,
			departmentName: employeeInfo.department_name,
			departmentCode: employeeInfo.department_code,
			// 职位信息
			positionId: employeeInfo.position_id,
			positionName: employeeInfo.position_name,
			positionLevel: employeeInfo.position_level,
			// 公司信息
			companyId: employeeInfo.company_id,
			companyName: employeeInfo.company_name,
			// 用印申请内容
			sealType: applicationData.form_data.seal_type,
			fileName: applicationData.form_data.file_name,
			fileType: applicationData.form_data.file_type,
			copies: applicationData.form_data.copies,
			urgencyLevel: applicationData.form_data.urgency_level,
			// 路由生成的审批人变量
			...routeResult.variables
		};

		// 3. 启动 BPMN 流程实例
		const processInstance = await vk.bpmn.startProcessInstance({
			processDefinitionKey: routeResult.process_definition_key,
			businessKey: `SEAL_${applicationId}`,
			variables: processVariables
		});

		// 4. 创建流程实例记录 (bpmn-instance)
		const instanceData = {
			_id: processInstance.id, // 使用 BPMN 引擎返回的实例ID
			process_definition_id: routeResult.process_definition_key,
			application_id: applicationId,
			business_key: `SEAL_${applicationId}`,
			start_time: now,
			status: 'active',
			current_tasks: [], // 将在下面填充
			variables: processVariables
		};

		await vk.baseDao.add({
			dbName: "bpmn-instance",
			dataJson: instanceData
		});

		// 5. 获取当前任务并创建任务记录
		const currentTasks = await vk.bpmn.getCurrentTasks(processInstance.id);
		let firstTaskName = '流程启动';

		for (const task of currentTasks) {
			firstTaskName = task.name;

			// 创建任务记录 (bpmn-task)
			const taskData = {
				_id: task.id, // 使用 BPMN 引擎返回的任务ID
				instance_id: processInstance.id,
				application_id: applicationId,
				task_key: task.taskDefinitionKey,
				task_name: task.name,
				assignee: task.assignee,
				assignee_name: await getEmployeeNameById(task.assignee, vk, db),
				status: 'pending',
				create_time: now,
				due_date: now + 3 * 24 * 60 * 60 * 1000 // 3天后
			};

			await vk.baseDao.add({
				dbName: "bpmn-task",
				dataJson: taskData
			});

			// 记录任务创建历史 (bpmn-task-history)
			const taskHistoryData = {
				task_id: task.id,
				application_id: applicationId,
				operator_id: userInfo.username, // 申请人ID
				operator_name: employeeInfo.employee_name,
				action: 'create',
				operation_time: now
			};

			await vk.baseDao.add({
				dbName: "bpmn-task-history",
				dataJson: taskHistoryData
			});

			// 更新实例的当前任务
			instanceData.current_tasks.push({
				task_id: task.id,
				task_name: task.name,
				assignee: task.assignee,
				create_time: now
			});
		}

		// 6. 更新实例的当前任务
		await vk.baseDao.updateById({
			dbName: "bpmn-instance",
			id: processInstance.id,
			dataJson: {
				current_tasks: instanceData.current_tasks
			}
		});

		// 7. 更新申请记录
		await vk.baseDao.updateById({
			dbName: "ebp_application_form",
			id: applicationId,
			dataJson: {
				process_instance_id: processInstance.id,
				process_definition_key: routeResult.process_definition_key,
				route_config_id: routeResult.route_config_id,
				condition_rule_code: routeResult.condition_rule_code,
				status: 'pending',
				current_task: firstTaskName,
				update_date: now
			}
		});

		console.log(`用印申请流程启动成功，实例ID: ${processInstance.id}`);

		// 8. 执行路由配置的前置动作
		await executePreActions(routeResult.config_context, applicationId, userInfo, employeeInfo);

	} catch (error) {
		console.error('启动用印申请流程失败:', error);
		throw new Error(`流程启动失败: ${error.message}`);
	}
}

// 根据员工ID获取员工姓名
async function getEmployeeNameById(employeeId, vk, db) {
	try {
		const hrmService = new HrmService(vk, db);
		const employeeInfo = await hrmService.getEmployeeInfoByUsername(employeeId);
		return employeeInfo.employee_name;
	} catch (error) {
		console.error('获取员工姓名失败:', error);
		return employeeId; // 如果获取失败，返回员工ID
	}
}

// 执行前置动作
async function executePreActions(configContext, applicationId, userInfo, employeeInfo) {
	if (!configContext || !configContext.pre_actions) {
		return;
	}

	for (const action of configContext.pre_actions) {
		try {
			switch (action.action_type) {
				case 'NOTIFY_MANAGERS':
					await notifyManagers(action.config, applicationId, userInfo, employeeInfo);
					break;
					// 可以扩展其他动作类型
			}
		} catch (error) {
			console.error(`执行前置动作失败: ${action.action_type}`, error);
		}
	}
}

// 通知管理员
async function notifyManagers(config, applicationId, userInfo, employeeInfo) {
	// 实际项目中应该集成消息系统
	console.log(`发送通知: ${config.message}, 申请ID: ${applicationId}, 申请人: ${employeeInfo.employee_name}`);
}