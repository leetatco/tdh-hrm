// cloudfunctions/admin/bpmn/process-engine/sys/startProcess.js
const HrmService = require('../../../../common/pub/class/hrm-service.js');
module.exports = {
	/**
	 * 启动流程实例 - 与试算流程配合版本
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
			console.log('启动流程参数:', { processDefinitionKey, businessKey, variables });

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

			if (definitionRes.data.length === 0) {
				return {
					code: -1,
					msg: '流程定义不存在或已停用',
					processDefinitionKey: `${processDefinitionKey}`
				};
			}

			const processDefinition = definitionRes.data[0];
			console.log('找到流程定义:', processDefinition.name, '节点数:', processDefinition.nodes.length);

			// 获取申请人信息
			const hrmService = new HrmService(vk, db);
			const employeeInfo = await hrmService.getEmployeeInfoByUsername(variables.applicant_id);
			console.log('申请人信息:', employeeInfo);

			// 创建流程实例
			const instanceData = {
				process_definition_id: processDefinition._id,
				process_definition_key: processDefinitionKey,
				application_id: businessKey,
				business_key: businessKey,
				start_time: Date.now(),
				status: 'active',
				variables: variables || {},
				current_tasks: [],				
				update_date: Date.now(),
				updat_id: uid
			};
			
			console.log('创建流程实例:', instanceData);

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
			
			console.log('流程实例创建成功:', instance_id);

			// 启动第一个任务 - 查找开始节点的下一节点
			const startNode = processDefinition.nodes.find(node => node.node_type === 'start');
			if (!startNode) {
				return {
					code: -1,
					msg: '流程定义中未找到开始节点'
				};
			}

			console.log('开始节点:', startNode.node_key);

			// 执行节点流转
			await executeNextNodes(instance_id, processDefinition, businessKey, startNode, variables, vk, db, employeeInfo);

			res.data = {
				instance_id: instance_id,
				process_definition_key: processDefinitionKey,
				success: true
			};
			res.msg = '流程启动成功';

			// 更新申请表的流程实例ID
			await vk.baseDao.updateById({
				dbName: "bpmn-application-form",
				id: businessKey,
				dataJson: {
					process_instance_id: instance_id,
					status: 'pending',
					update_date: Date.now()
				}
			});

		} catch (error) {
			console.error('启动流程异常:', error);
			return {
				code: -1,
				msg: error.message
			};
		}

		return res;
	}
};

/**
 * 执行节点流转 - 修复版本
 */
async function executeNextNodes(instanceId, processDefinition, businessKey, currentNode, variables, vk, db, employeeInfo) {
	console.log(`执行节点流转: ${currentNode.node_key} (${currentNode.node_name})`);
	
	if (!currentNode.next_nodes || currentNode.next_nodes.length === 0) {
		console.log(`节点 ${currentNode.node_key} 没有下一节点，停止流转`);
		return;
	}

	// 记录已执行的节点，避免循环
	const executedNodes = new Set();

	for (const nextNodeConfig of currentNode.next_nodes) {
		const nextNode = processDefinition.nodes.find(node => node.node_key === nextNodeConfig.node_key);
		if (!nextNode) {
			console.warn(`下一节点不存在: ${nextNodeConfig.node_key}`);
			continue;
		}
		
		if (executedNodes.has(nextNode.node_key)) {
			console.log(`节点 ${nextNode.node_key} 已执行，跳过`);
			continue;
		}

		// 检查条件规则
		let shouldExecute = true;
		if (nextNodeConfig.condition_rule_code) {
			console.log(`检查条件规则: ${nextNodeConfig.condition_rule_code}`);
			shouldExecute = await evaluateConditionRule(nextNodeConfig.condition_rule_code, variables, db);
			console.log(`条件规则评估结果: ${shouldExecute}`);
			
			if (!shouldExecute && !nextNodeConfig.default_path) {
				console.log(`条件不匹配且非默认路径，跳过节点: ${nextNode.node_key}`);
				continue;
			}
		}

		if (shouldExecute) {
			console.log(`执行节点: ${nextNode.node_key}`);
			executedNodes.add(nextNode.node_key);
			
			// 执行当前节点
			await executeNode(instanceId, processDefinition, businessKey, nextNode, variables, vk, db, employeeInfo);

			// 如果是网关节点，需要继续流转到所有符合条件的下一节点
			if (nextNode.node_type === 'gateway') {
				console.log(`网关节点 ${nextNode.node_key}，继续流转`);
				await executeNextNodes(instanceId, processDefinition, businessKey, nextNode, variables, vk, db, employeeInfo);
			}
			// 如果是任务节点，只创建任务，不自动流转（等待任务完成）
			else if (nextNode.node_type === 'userTask' || nextNode.node_type === 'approval' || nextNode.node_type === 'review') {
				console.log(`任务节点 ${nextNode.node_key}，任务已创建，等待处理`);
				// 任务节点不自动流转，等待任务完成后再流转
			}
			// 其他节点类型继续流转
			else if (nextNode.node_type !== 'end') {
				console.log(`非结束节点 ${nextNode.node_key}，继续流转`);
				await executeNextNodes(instanceId, processDefinition, businessKey, nextNode, variables, vk, db, employeeInfo);
			}

			// 如果是默认路径或者排他网关，只执行一条路径
			if (nextNodeConfig.default_path || currentNode.node_type === 'gateway') {
				console.log(`默认路径或网关节点，停止评估其他路径`);
				break;
			}
		}
	}
}

/**
 * 执行节点 - 修复版本
 */
async function executeNode(instanceId, processDefinition, businessKey, node, variables, vk, db, employeeInfo) {
	console.log(`执行节点: ${node.node_key} (${node.node_type})`);
	
	switch (node.node_type) {
		case 'userTask':
		case 'approval':
		case 'review':
			await createTask(instanceId, processDefinition, businessKey, node, variables, vk, db, employeeInfo);
			break;
		case 'gateway':
			// 网关节点不需要创建任务，直接流转
			console.log(`网关节点 ${node.node_key}，直接流转`);
			break;
		case 'end':
			await endProcess(instanceId, 'completed', vk, db);
			break;
		default:
			console.warn(`未知节点类型: ${node.node_type}`);
	}
}

/**
 * 创建任务 - 修复版本
 */
async function createTask(instanceId, processDefinition, businessKey, node, variables, vk, db, employeeInfo) {
	try {
		console.log(`创建任务: ${node.node_name}(${node.node_key})`);
		
		// 解析任务负责人 - 优先使用试算结果中的负责人
		let assigneeInfo = null;
		
		// 检查是否有试算结果中的负责人信息
		if (variables.simulation_assignees && variables.simulation_assignees[node.node_key]) {
			console.log('使用试算结果中的负责人信息',variables);
			assigneeInfo = variables.simulation_assignees[node.node_key];
		} else {
			// 没有试算结果，实时解析负责人
			console.log('实时解析负责人');
			assigneeInfo = await resolveAssignee(node, variables, vk, db, employeeInfo);
		}

		if (!assigneeInfo || !assigneeInfo.userId) {
			throw new Error(`无法解析节点 ${node.node_name} 的负责人`);
		}

		console.log(`任务负责人: ${assigneeInfo.userName} (${assigneeInfo.userId})`);

		// 计算截止时间
		let dueDate = null;
		if (node.time_limit) {
			dueDate = Date.now() + node.time_limit * 60 * 60 * 1000; // 小时转毫秒
		}

		const taskData = {
			instance_id: instanceId,
			application_id: businessKey,
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
				form_schema: node.form_schema || null,
				node_config: {
					assignee_type: node.assignee_type,
					assignee_value: node.assignee_value
				}
			}
		};

		const task_id = await vk.baseDao.add({
			dbName: "bpmn-task",
			dataJson: taskData
		});

		if (!task_id) {
			throw new Error('任务创建失败');
		}
		
		console.log(`任务创建成功: ${task_id}`);

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
					assignee: assigneeInfo.userName,
					task_key: node.node_key
				}
			}
		});

		// 发送任务通知
		await sendTaskNotification(task_id, node, assigneeInfo, variables, vk);

	} catch (error) {
		console.error(`创建任务失败: ${node.node_name}`, error);
		throw error;
	}
}

/**
 * 解析负责人 - 修复版本
 */
async function resolveAssignee(node, variables, vk, db, employeeInfo) {
	console.log(`解析负责人，节点: ${node.node_key}, 类型: ${node.assignee_type}, 值: ${node.assignee_value}`);
	
	const {
		assignee_type,
		assignee_value
	} = node;

	try {
		const hrmService = new HrmService(vk, db);
		
		switch (assignee_type) {
			case 'user':
				// 直接指定用户
				console.log(`直接指定用户: ${assignee_value}`);
				const userInfo = await hrmService.getEmployeeInfoByUsername(assignee_value);
				if (userInfo) {
					return {
						userId: userInfo.employee_id,
						userName: userInfo.employee_name || assignee_value
					};
				}
				break;

			case 'role':
				// 根据角色查找用户
				console.log(`根据角色查找: ${assignee_value}`);
				return await findUserByRole(assignee_value, variables, vk, db);

			case 'department':
				// 根据部门查找负责人
				console.log(`根据部门查找: ${assignee_value}`);
				return await findDepartmentManager(assignee_value, vk, db, employeeInfo);

			case 'variable':
				// 从流程变量中获取
				console.log(`从变量中获取: ${assignee_value}`);
				const variableValue = getValueFromData(assignee_value, variables, {});
				if (variableValue) {
					const varUserInfo = await hrmService.getEmployeeInfoByUsername(variableValue);
					if (varUserInfo) {
						return {
							userId: varUserInfo.employee_id,
							userName: varUserInfo.employee_name || variableValue
						};
					}
				}
				break;

			case 'previous':
				// 上一节点处理人 - 从任务历史中查找
				console.log('获取上一节点处理人');
				return await findPreviousAssignee(variables, db);

			case 'applicant':
				// 申请人
				console.log('使用申请人作为负责人');
				return {
					userId: employeeInfo.employee_id,
					userName: employeeInfo.employee_name || '申请人'
				};

			case 'start':
				// 开始节点负责人 - 用印申请专用：申请人部门主管
				console.log('开始节点负责人 - 部门主管');
				return {
					userId: employeeInfo.department_manager_id,
					userName: employeeInfo.department_manager_name || '部门主管'
				};

			default:
				console.warn(`未知的负责人类型: ${assignee_type}`);
		}
	} catch (error) {
		console.error('解析负责人失败:', error);
	}

	// 默认返回申请人（避免任务无法分配）
	console.log('使用默认负责人（申请人）');
	return {
		userId: employeeInfo.employee_id,
		userName: employeeInfo.employee_name || '申请人'
	};
}

/**
 * 从数据中获取值（辅助函数）
 */
function getValueFromData(field, formData, calculatedValues) {
	if (!field) return undefined;

	const fields = field.split('.');
	let value = {
		...formData,
		...calculatedValues
	};

	for (const f of fields) {
		if (value && typeof value === 'object' && f in value) {
			value = value[f];
		} else {
			return undefined;
		}
	}

	return value;
}

/**
 * 根据角色查找用户 - 修复版本
 */
async function findUserByRole(role, variables, vk, db) {
	console.log(`查找角色用户: ${role}`);
	
	try {
		// 首先尝试从uni-id-users中查找具有该角色的用户
		const usersRes = await db.collection('uni-id-users')
			.where({
				role: role
			})
			.get();

		console.log(`角色 ${role} 的用户查询结果:`, usersRes.data);

		if (usersRes.data.length > 0) {
			const user = usersRes.data[0]; // 暂时取第一个
			const hrmService = new HrmService(vk, db);
			const employeeInfo = await hrmService.getEmployeeInfoByUsername(user.username);
			
			return {
				userId: employeeInfo ? employeeInfo.employee_id : user._id,
				userName: employeeInfo ? employeeInfo.employee_name : (user.nickname || user.username)
			};
		}

		// 如果找不到，尝试从员工表中查找
		const roleMapping = {
			'dept_manager': '部门经理',
			'seal_manager': '印章管理员',
			'direct_manager': '直接主管',
			'division_director': '分管总监',
			'finance_manager': '财务经理'
		};

		const positionName = roleMapping[role] || role;
		const employeeRes = await db.collection('hrm-employees')
			.where({
				position_name: positionName
			})
			.get();

		if (employeeRes.data.length > 0) {
			const employee = employeeRes.data[0];
			return {
				userId: employee.employee_id,
				userName: employee.employee_name
			};
		}

		throw new Error(`找不到角色为 ${role} 的用户`);
	} catch (error) {
		console.error('根据角色查找用户失败:', error);
		throw error;
	}
}

/**
 * 查找部门经理 - 修复版本
 */
async function findDepartmentManager(department, vk, db, employeeInfo) {
	console.log(`查找部门经理，部门: ${department}`);
	
	try {
		// 如果department是部门ID，查询部门经理
		if (department) {
			const deptRes = await vk.callFunction({
				url: 'admin/hrm/department/pub/getDeptManager',
				data: {
					department_id: department
				}
			});

			if (deptRes.code === 0 && deptRes.data) {
				const manager = deptRes.data;
				return {
					userId: manager.employee_id,
					userName: manager.employee_name || '部门经理'
				};
			}
		}

		// 如果没有指定部门或查询失败，使用申请人所在部门的经理
		console.log('使用申请人所在部门的经理');
		return {
			userId: employeeInfo.department_manager_id,
			userName: employeeInfo.department_manager_name || '部门经理'
		};

	} catch (error) {
		console.error('查找部门经理失败:', error);
		// 失败时返回申请人部门经理
		return {
			userId: employeeInfo.department_manager_id,
			userName: employeeInfo.department_manager_name || '部门经理'
		};
	}
}

/**
 * 查找上一节点处理人 - 修复版本
 */
async function findPreviousAssignee(variables, db) {
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
 * 评估条件规则 - 修复版本
 */
async function evaluateConditionRule(conditionRuleCode, variables, db) {
	if (!conditionRuleCode) return true;

	try {
		// 查询条件规则
		const ruleRes = await db.collection('bpmn-condition-rule')
			.where({
				code: conditionRuleCode,
				status: 'active'
			})
			.get();

		if (ruleRes.data.length === 0) {
			console.warn(`条件规则不存在: ${conditionRuleCode}`);
			return false;
		}

		const rule = ruleRes.data[0];
		return await evaluateRuleExpression(rule.rule_expression, variables, {});
	} catch (error) {
		console.error('评估条件规则失败:', error);
		return false;
	}
}

/**
 * 评估规则表达式 - 修复版本
 */
async function evaluateRuleExpression(ruleExpression, formData, calculatedValues) {
	if (!ruleExpression) return true;

	const {
		type,
		conditions,
		logic
	} = ruleExpression;

	if (type === 'simple' && conditions && conditions.length > 0) {
		const results = conditions.map(condition => {
			const {
				field,
				operator,
				value,
				value_type
			} = condition;

			// 获取实际值
			let actualValue = getValueFromData(field, formData, calculatedValues);
			let compareValue = value;

			// 根据值类型处理比较值
			if (value_type === 'variable') {
				compareValue = getValueFromData(value, formData, calculatedValues);
			}

			// 执行比较
			return compareValues(actualValue, operator, compareValue);
		});

		// 根据逻辑关系返回结果
		if (logic === 'or') {
			return results.some(result => result);
		} else {
			return results.every(result => result);
		}
	}

	return true;
}

/**
 * 比较值 - 修复版本
 */
function compareValues(actualValue, operator, compareValue) {
	// 处理undefined或null的情况
	if (actualValue === undefined || actualValue === null) {
		return false;
	}

	switch (operator) {
		case 'eq':
			return actualValue == compareValue;
		case 'ne':
			return actualValue != compareValue;
		case 'gt':
			return Number(actualValue) > Number(compareValue);
		case 'gte':
			return Number(actualValue) >= Number(compareValue);
		case 'lt':
			return Number(actualValue) < Number(compareValue);
		case 'lte':
			return Number(actualValue) <= Number(compareValue);
		case 'in':
			return Array.isArray(compareValue) ? compareValue.includes(actualValue) : false;
		case 'not_in':
			return Array.isArray(compareValue) ? !compareValue.includes(actualValue) : true;
		case 'contains':
			return String(actualValue).includes(String(compareValue));
		case 'regex':
			try {
				const regex = new RegExp(compareValue);
				return regex.test(String(actualValue));
			} catch {
				return false;
			}
		default:
			console.warn('未知的操作符:', operator);
			return false;
	}
}

/**
 * 更新实例当前任务 - 修复版本
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
 * 发送任务通知 - 修复版本
 */
async function sendTaskNotification(taskId, node, assigneeInfo, variables, vk) {
	try {
		const notificationData = {
			type: 'task_assign',
			title: `您有新的待办任务：${node.node_name}`,
			content: `请及时处理任务：${node.node_name}`,
			recipients: [assigneeInfo.userId],
			data: {
				task_id: taskId,
				task_name: node.node_name,
				assignee: assigneeInfo.userName,
				application_id: variables.application_id,
				applicant_name: variables.applicant_name || variables.employeeInfo?.employee_name,
				timestamp: Date.now()
			}
		};

		// 如果是紧急任务，设置优先级
		if (variables.emergency_level === '紧急' || variables.emergency_level === '特急') {
			notificationData.priority = 'high';
		}

		await vk.callFunction({
			url: 'admin/system/notification/sys/send',
			data: notificationData
		});

		console.log(`任务通知已发送给: ${assigneeInfo.userName}`);
	} catch (error) {
		console.error('发送任务通知失败:', error);
		// 通知失败不应影响主流程
	}
}

/**
 * 结束流程 - 修复版本
 */
async function endProcess(instanceId, endStatus, vk, db) {
	try {
		// 更新实例状态
		await vk.baseDao.updateById({
			dbName: "bpmn-instance",
			id: instanceId,
			dataJson: {
				status: endStatus,
				end_time: Date.now(),
				update_date: Date.now()
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
 * 发送流程结束通知 - 修复版本
 */
async function sendProcessEndNotification(applicationId, status, vk) {
	try {
		// 获取申请信息
		const applicationRes = await vk.callFunction({
			url: 'admin/bpmn/application-form/sys/detail',
			data: {
				_id: applicationId
			}
		});

		if (applicationRes.code === 0 && applicationRes.data) {
			const application = applicationRes.data.application;
			const statusText = status === 'approved' ? '已通过' :
				status === 'rejected' ? '已驳回' : '已取消';

			await vk.callFunction({
				url: 'admin/system/notification/sys/send',
				data: {
					type: 'process_end',
					title: `申请${statusText}`,
					content: `您的申请"${application.title}"${statusText}`,
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