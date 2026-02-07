// cloudfunctions/admin/bpmn/process-engine/sys/startProcess.js
const HrmService = require('../../../../common/pub/class/hrm-service.js');
module.exports = {
	/**
	 * 启动流程实例 - 优化版本
	 * @url admin/bpmn/process-engine/sys/startProcess
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
			processDefinitionKey,
			businessKey,
			variables
		} = data;
		let res = {
			code: 0,
			msg: ''
		};

		try {
			console.log(1, variables)
			const hrmService = new HrmService(vk, db);
			const employeeInfo = await hrmService.getEmployeeInfoByUsername(variables.applicant_id);

			console.log(1)

			if (!processDefinitionKey) {
				return {
					code: -1,
					msg: '流程定义KEY不能为空'
				};
			}

			if (!businessKey) {
				return {
					code: -1,
					msg: '业务KEY不能为空'
				};
			}

			// 查询流程定义
			const definitionRes = await db.collection('bpmn-definition')
				.where({
					key: processDefinitionKey,
					status: 'active'
				})
				.orderBy('version', 'desc')
				.limit(1)
				.get();

			console.log(2)

			if (definitionRes.data.length === 0) {
				return {
					code: -1,
					msg: '流程定义不存在或已停用',
					processDefinitionKey: `${processDefinitionKey}`
				};
			}

			const processDefinition = definitionRes.data[0];

			console.log(3, processDefinition)

			// 创建流程实例
			const instanceData = {
				process_definition_id: processDefinition._id,
				application_id: businessKey,//表单ID
				business_key: businessKey,
				start_time: Date.now(),
				status: 'active',
				variables: variables || {},
				current_tasks: [],
				update_date: Date.now(),
				updat_id: uid
			};

			const instance_id = await vk.baseDao.add({
				dbName: "bpmn-instance",
				dataJson: instanceData
			});

			if (!instance_id) {
				return {
					code: -1,
					msg: '流程实例创建失败'
				};
			}

			console.log(4)

			// 启动第一个任务
			const startNode = processDefinition.nodes.find(node => node.node_type === 'start');
			if (!startNode) {
				return {
					code: -1,
					msg: '流程定义中未找到开始节点'
				};
			}

			// 执行节点流转
			await executeNextNodes(instance_id, processDefinition, businessKey, startNode, variables, vk, db, employeeInfo);

			res.data = {
				instance_id: instance_id,
				process_definition_key: processDefinitionKey,
				success: true
			};
			res.msg = '流程启动成功';

		} catch (error) {
			return {
				code: -1,
				msg: error.message
			};
		}

		return res;
	}
};

/**
 * 执行节点流转 - 优化版本
 */
async function executeNextNodes(instanceId, processDefinition, businessKey, currentNode, variables, vk, db, employeeInfo) {
	if (!currentNode.next_nodes || currentNode.next_nodes.length === 0) {
		return;
	}

	// 记录已执行的节点，避免循环
	const executedNodes = new Set();

	for (const nextNodeConfig of currentNode.next_nodes) {
		const nextNode = processDefinition.nodes.find(node => node.node_key === nextNodeConfig.node_key);
		if (!nextNode || executedNodes.has(nextNode.node_key)) continue;

		// 检查条件规则
		let shouldExecute = true;
		if (nextNodeConfig.condition_rule_code) {
			shouldExecute = await evaluateConditionRule(nextNodeConfig.condition_rule_code, variables, db);
			if (!shouldExecute && !nextNodeConfig.default_path) {
				continue;
			}
		}

		if (shouldExecute) {
			executedNodes.add(nextNode.node_key);
			await executeNode(instanceId, processDefinition, businessKey, nextNode, variables, vk, db, employeeInfo);

			// 如果是网关节点，需要继续流转
			if (nextNode.node_type === 'gateway') {
				await executeNextNodes(instanceId, processDefinition, nextNode, variables, vk, db, employeeInfo);
			}

			// 如果是默认路径或者条件匹配，只执行一条路径（排他网关）
			if (nextNodeConfig.default_path) {
				break;
			}
		}
	}
}

/**
 * 执行节点 - 优化版本
 */
async function executeNode(instanceId, processDefinition, businessKey, node, variables, vk, db, employeeInfo) {
	console.log("node:",node)
	switch (node.node_type) {
		case 'userTask':
		case 'approval':
		case 'review':
			await createTask(instanceId, processDefinition, businessKey, node, variables, vk, db, employeeInfo);
			break;
		case 'gateway':
			// 网关节点不需要创建任务，直接流转
			break;
		case 'end':
			await endProcess(instanceId, 'completed', vk, db, employeeInfo);
			break;
		default:
			console.warn(`未知节点类型: ${node.node_type}`);
	}
}

/**
 * 创建任务 - 优化版本
 */
async function createTask(instanceId, processDefinition, businessKey, node, variables, vk, db, employeeInfo) {
	try {
		// 解析任务负责人
		const assigneeInfo = await resolveAssignee(node, variables, vk, db, employeeInfo);

		if (!assigneeInfo.userId) {
			throw new Error(`无法解析节点 ${node.node_name} 的负责人`);
		}

		// 计算截止时间
		let dueDate = null;
		if (node.time_limit) {
			dueDate = Date.now() + node.time_limit * 60 * 60 * 1000; // 小时转毫秒
		}
		
		console.log("assigneeInfo:",assigneeInfo);
		
		console.log("variables:",variables)

		const taskData = {
			instance_id: instanceId,
			application_id: businessKey,//申请表单ID
			task_key: node.node_key,
			task_name: node.node_name,
			assignee: assigneeInfo.userId,
			assignee_name: assigneeInfo.userName,
			candidate_users: node.candidate_users || [],
			candidate_groups: node.candidate_groups || [],
			candidate_roles: node.candidate_roles || [],
			candidate_departments: node.candidate_departments || [],
			status: 'pending',
			create_time: Date.now(),
			due_date: dueDate,
			required_approvals: node.required_approvals || 1,
			current_approvals: 0,
			task_data: {
				actions: node.actions || ['approve', 'reject'],
				form_schema: node.form_schema || null
			}
		};

		const task_id = await vk.baseDao.add({
			dbName: "bpmn-task",
			dataJson: taskData
		});

		if (!task_id) {
			throw new Error('任务创建失败');
		}

		// 更新实例的当前任务
		await updateInstanceCurrentTasks(instanceId, task_id, node, assigneeInfo, db);

		// 记录任务历史
		await vk.baseDao.add({
			dbName: "bpmn-task-history",
			dataJson: {
				task_id: task_id,
				application_id: taskData.application_id,
				operator_id: 'system',
				operator_name: '系统',
				action: 'create',
				operation_time: Date.now(),
				task_snapshot: {
					task_name: node.node_name,
					assignee: assigneeInfo.userName
				}
			}
		});

		// 发送任务通知
		// await sendTaskNotification(task_id, node, assigneeInfo, variables, vk);

		console.log(`任务创建成功: ${node.node_name}, 负责人: ${assigneeInfo.userName}`);

	} catch (error) {
		console.error(`创建任务失败: ${node.node_name}`, error);
		throw error;
	}
}

/**
 * 更新实例当前任务
 */
async function updateInstanceCurrentTasks(instanceId, taskId, node, assigneeInfo, db) {
	const taskInfo = {
		task_id: taskId,
		task_name: node.node_name,
		task_key: node.node_key,
		assignee: assigneeInfo.userId,
		assignee_name: assigneeInfo.userName,
		create_time: Date.now()
	};

	await db.collection('bpmn-instance').doc(instanceId).update({
		current_tasks: db.command.push(taskInfo)
	});
}

/**
 * 解析负责人 - 优化版本
 */
async function resolveAssignee(node, variables, vk, db, employeeInfo) {
	console.log("node:", node)	
	const {
		assignee_type,
		assignee_value
	} = node;

	try {
		const hrmService = new HrmService(vk, db);
		switch (assignee_type) {
			case 'user':
				// 直接指定用户			
				const assigneeInfo = await hrmService.getEmployeeInfoByUsername(assignee_value);
				if (assigneeInfo) {
					return {
						userId: assigneeInfo.employee_id,
						userName: assigneeInfo.employee_name || '未知用户'
					};
				}
				break;

			case 'role':
				// 根据角色查找用户 - 用印申请专用逻辑
				return await findUserByRole(assignee_value, variables, db, employeeInfo);

			case 'department':
				// 根据部门查找负责人
				return await findDepartmentManager(assignee_value, db, employeeInfo);

			case 'variable':
				// 从流程变量中获取
				const variableUser = variables[assignee_value];
				if (variableUser) {
					// 假设变量中存储的是用户ID					
					if (assigneeInfo) {
						return {
							userId: assigneeInfo.employee_id,
							userName: assigneeInfo.employee_name || '未知用户'
						};
					}
				}
				break;

			case 'previous':
				// 上一节点处理人 - 从任务历史中查找
				return await findPreviousAssignee(node, variables, db, employeeInfo);

			case 'applicant':
				// 申请人
				console.log(33333333333333333)
				assigneeInfo = await hrmService.getEmployeeInfoByUsername(variables.applicant_id);
				return {
					userId: assigneeInfo.employee_id,
						userName: assigneeInfo.employee_name || '申请人'
				};

			default:
				console.warn(`未知的负责人类型: ${assignee_type}`);
		}
	} catch (error) {
		console.error('解析负责人失败:', error);
	}

	// 默认返回系统用户（应该避免这种情况）
	return {
		userId: 'system',
		userName: '系统管理员'
	};
}

/**
 * 根据角色查找用户 - 用印申请专用
 */
async function findUserByRole(role, variables, db) {
	// 用印申请特定的角色处理逻辑
	const roleMapping = {
		'dept_manager': '部门经理',
		'seal_manager': '印章管理员',
		'direct_manager': '直接主管',
		'division_director': '分管总监',
		'finance_manager': '财务经理'
	};

	// 首先尝试从uni-id-users中查找具有该角色的用户_id : _.in(["1","2","3"])
	const usersRes = await db.collection('uni-id-users')
		.where({
			role: role
		})
		.get();

	if (usersRes.data.length > 0) {
		// 如果有多个用户，可以根据部门等条件进一步筛选
		const user = usersRes.data[0]; // 暂时取第一个
		return {
			userId: user._id,
			userName: user.username || user.nickname || roleMapping[role] || role
		};
	}

	// 如果找不到，尝试从员工表中查找
	const employeeRes = await db.collection('hrm-employees')
		.where({
			position: roleMapping[role] || role
		})
		.get();

	if (employeeRes.data.length > 0) {
		const employee = employeeRes.data[0];
		return {
			userId: employee.user_id || employee._id,
			userName: employee.name || roleMapping[role] || role
		};
	}

	throw new Error(`找不到角色为 ${role} 的用户`);
}

/**
 * 查找部门经理
 */
async function findDepartmentManager(department, db, employeeInfo) {
	// 这里需要根据具体的部门管理逻辑实现
	// 暂时返回一个默认用户
	console.log(employeeInfo)
	return {
		userId: employeeInfo.department_manager_id,
		userName: employeeInfo.department_manager_name || '部门经理'
	};


	throw new Error(`找不到部门 ${department} 的经理`);
}

/**
 * 查找上一节点处理人
 */
async function findPreviousAssignee(node, variables, db, employeeInfo) {
	const instanceId = variables.instance_id;
	if (!instanceId) {
		throw new Error('无法获取流程实例ID');
	}

	// 查找最近完成的任务
	const tasksRes = await db.collection('bpmn-task')
		.where({
			instance_id: instanceId,
			status: 'completed'
		})
		.orderBy('complete_time', 'desc')
		.limit(1)
		.get();

	if (tasksRes.data.length > 0) {
		const task = tasksRes.data[0];
		return {
			userId: task.assignee,
			userName: task.assignee_name
		};
	}

	throw new Error('找不到上一节点处理人');
}

/**
 * 结束流程 - 优化版本
 */
async function endProcess(instanceId, endStatus, vk, db) {
	try {
		// 更新实例状态
		await vk.baseDao.updateById({
			dbName: "bpmn-instance",
			id: instanceId,
			dataJson: {
				status: endStatus,
				end_time: Date.now()
			}
		});

		// 更新申请状态
		const instanceRes = await db.collection('bpmn-instance').doc(instanceId).get();
		if (instanceRes.data) {
			const applicationId = instanceRes.data.application_id;
			let applicationStatus = 'approved';

			if (endStatus === 'terminated') {
				applicationStatus = 'rejected';
			} else if (endStatus === 'cancelled') {
				applicationStatus = 'cancelled';
			}

			await db.collection('bpmn-application-form').doc(applicationId).update({
				status: applicationStatus,
				update_date: Date.now()
			});

			// 发送流程结束通知
			await sendProcessEndNotification(applicationId, applicationStatus, vk);
		}

		console.log(`流程实例 ${instanceId} 已结束，状态: ${endStatus}`);
	} catch (error) {
		console.error('结束流程失败:', error);
		throw error;
	}
}

/**
 * 发送任务通知 - 优化版本
 */
async function sendTaskNotification(taskId, node, assigneeInfo, variables, vk) {
	try {
		const notificationData = {
			type: 'task_assign',
			title: `您有新的待办任务：${node.task_name || node.node_name}`,
			content: `请及时处理任务：${node.task_name || node.node_name}`,
			recipients: [assigneeInfo.userId],
			data: {
				task_id: taskId,
				task_name: node.task_name || node.node_name,
				assignee: assigneeInfo.userName,
				application_id: variables.application_id,
				applicant_name: variables.applicant_name,
				timestamp: Date.now()
			}
		};

		// 如果是紧急任务，设置优先级
		if (variables.urgency_level === 'urgent' || variables.urgency_level === 'very_urgent') {
			notificationData.priority = 'high';
		}

		await vk.cloud.callFunction({
			name: 'admin/system/notification/sys/send',
			dataJson: notificationData
		});

		console.log(`任务通知已发送给: ${assigneeInfo.userName}`);
	} catch (error) {
		console.error('发送任务通知失败:', error);
		// 通知失败不应影响主流程
	}
}

/**
 * 发送流程结束通知
 */
async function sendProcessEndNotification(applicationId, status, vk) {
	try {
		// 获取申请信息
		const applicationRes = await vk.cloud.callFunction({
			name: 'admin/bpmn/application-form/sys/detail',
			data: {
				_id: applicationId
			}
		});

		if (applicationRes.code === 0 && applicationRes.data) {
			const application = applicationRes.data.application;
			const statusText = status === 'approved' ? '已通过' :
				status === 'rejected' ? '已驳回' : '已取消';

			await vk.cloud.callFunction({
				name: 'admin/system/notification/sys/send',
				data: {
					type: 'process_end',
					title: `用印申请${statusText}`,
					content: `您的用印申请"${application.title}"${statusText}`,
					recipients: [application.applicant_id],
					data: {
						application_id: applicationId,
						application_title: application.title,
						status: status,
						status_text: statusText,
						timestamp: Date.now()
					}
				}
			});
		}
	} catch (error) {
		console.error('发送流程结束通知失败:', error);
	}
}

// 其他辅助函数保持不变（evaluateConditionRule, evaluateRuleExpression等）