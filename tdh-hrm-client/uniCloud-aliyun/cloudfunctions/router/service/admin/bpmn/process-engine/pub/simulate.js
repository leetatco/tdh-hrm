// cloudfunctions/admin/bpmn/process-engine/sys/simulate.js
const HrmService = require('../../../../common/pub/class/hrm-service.js');
module.exports = {
	/**
	 * 流程试算 - 模拟流程走向
	 * @url admin/bpmn/process-engine/sys/simulate 前端调用的url参数地址
	 */
	main: async (event) => {
		let {
			data = {}, util, filterResponse, originalParam
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
			uid
		} = data;
		let res = {
			code: 0,
			msg: ''
		};

		const {
			form_type_code,
			form_data,
			calculated_values,
			process_definition_key,
			userInfo
		} = data;

		if (!form_type_code) {
			return {
				code: -1,
				msg: '表单类型编码不能为空'
			};
		}

		try {
			//加入申请人详细个人信息
			const hrmService = new HrmService(vk, db);
			const employeeInfo = await hrmService.getEmployeeInfoByUsername(userInfo.username);
			form_data.employeeInfo = employeeInfo;

			// 1. 获取表单类型信息
			const formType = await getFormType(form_type_code, db);
			if (!formType) {
				return {
					code: -1,
					msg: '表单类型不存在'
				};
			}

			// 2. 确定流程定义
			const processDefinition = await determineProcessDefinition(
				form_type_code,
				form_data,
				calculated_values,
				process_definition_key,
				db
			);

			if (!processDefinition) {
				return {
					code: -1,
					msg: '未找到合适的流程定义'
				};
			}

			console.log('找到流程定义:', processDefinition.key, '节点数:', processDefinition.nodes.length);

			// 3. 模拟流程执行
			const simulationResult = await simulateProcess(
				processDefinition,
				form_data,
				calculated_values,
				userInfo,
				vk,
				db
			);

			res.data = {
				form_type: formType.name,
				process_definition: {
					key: processDefinition.key,
					name: processDefinition.name,
					version: processDefinition.version
				},
				...simulationResult
			};

			res.msg = '流程试算完成';

		} catch (error) {
			console.error('流程试算失败:', error);
			return {
				code: -1,
				msg: error.message || '流程试算失败'
			};
		}

		return res;
	}
}

/**
 * 获取表单类型
 */
async function getFormType(formTypeCode, db) {
	try {
		const res = await db.collection('bpmn-form-type')
			.where({
				code: formTypeCode,
				status: 'active'
			})
			.get();

		return res.data && res.data.length > 0 ? res.data[0] : null;
	} catch (error) {
		console.error('获取表单类型失败:', error);
		return null;
	}
}

/**
 * 确定流程定义
 */
async function determineProcessDefinition(formTypeCode, formData, calculatedValues, specifiedKey, db) {
	// 如果指定了流程定义KEY，直接使用
	console.log("如果指定了流程定义KEY，直接使用:", specifiedKey);
	if (specifiedKey) {
		const definition = await getProcessDefinitionByKey(specifiedKey, db);
		if (definition) return definition;
	}

	// 否则根据路由配置确定流程定义
	return await routeToProcessDefinition(formTypeCode, formData, calculatedValues, db);
}

/**
 * 根据KEY获取流程定义
 */
async function getProcessDefinitionByKey(processKey, db) {
	try {
		const res = await db.collection('bpmn-definition')
			.where({
				key: processKey,
				status: 'active'
			})
			.orderBy('version', 'desc')
			.get();

		return res.data && res.data.length > 0 ? res.data[0] : null;
	} catch (error) {
		console.error('获取流程定义失败:', error);
		return null;
	}
}

/**
 * 路由到流程定义
 */
async function routeToProcessDefinition(formTypeCode, formData, calculatedValues, db) {
	try {
		// 查询流程路由配置
		const routeConfigRes = await db.collection('bpmn-process-route-config')
			.where({
				form_type_code: formTypeCode,
				status: 'active'
			})
			.orderBy('priority', 'asc')
			.get();

		console.log('路由配置查询结果:', routeConfigRes.data);

		if (routeConfigRes.data.length === 0) {
			// 如果没有配置路由，使用默认流程
			const defaultProcess = await getProcessDefinitionByKey(`${formTypeCode}_DEFAULT`, db);
			return defaultProcess;
		}

		// 评估条件规则，选择匹配的流程
		for (const config of routeConfigRes.data) {
			const matched = await evaluateConditionRule(config.condition_rule_code, formData, calculatedValues, db);
			console.log(`条件规则 ${config.condition_rule_code} 评估结果:`, matched);
			if (matched) {
				const processDefinition = await getProcessDefinitionByKey(config.process_definition_key, db);
				if (processDefinition) return processDefinition;
			}
		}

		// 如果没有匹配的规则，使用回退配置或默认流程
		const fallbackConfig = routeConfigRes.data.find(config => config.fallback);
		if (fallbackConfig) {
			const processDefinition = await getProcessDefinitionByKey(fallbackConfig.process_definition_key, db);
			if (processDefinition) return processDefinition;
		}

		// 最后尝试默认流程
		return await getProcessDefinitionByKey(`${formTypeCode}_DEFAULT`, db);

	} catch (error) {
		console.error('流程路由失败:', error);
		return null;
	}
}

/**
 * 评估条件规则
 */
async function evaluateConditionRule(conditionRuleCode, formData, calculatedValues, db) {
	if (!conditionRuleCode) {
		console.log('没有条件规则代码，直接返回true');
		return true;
	}

	try {
		// 查询条件规则
		const ruleRes = await db.collection('bpmn-condition-rule')
			.where({
				code: conditionRuleCode,
				status: 'active'
			})
			.get();

		if (!ruleRes.data || ruleRes.data.length === 0) {
			console.warn('条件规则不存在:', conditionRuleCode);
			return false;
		}

		const rule = ruleRes.data[0];
		console.log('找到条件规则:', rule.name, '表达式:', rule.rule_expression);
		return await evaluateRuleExpression(rule.rule_expression, formData, calculatedValues);
	} catch (error) {
		console.error('评估条件规则失败:', error);
		return false;
	}
}

/**
 * 评估规则表达式
 */
async function evaluateRuleExpression(ruleExpression, formData, calculatedValues) {
	if (!ruleExpression) {
		console.log('没有规则表达式，返回true');
		return true;
	}

	const {
		type,
		conditions,
		logic
	} = ruleExpression;
	console.log('评估规则表达式:', {
		type,
		conditions,
		logic
	});

	if (type === 'simple' && conditions && conditions.length > 0) {
		const results = conditions.map(condition => {
			const {
				field,
				operator,
				value,
				value_type
			} = condition;
			console.log('评估条件:', {
				field,
				operator,
				value,
				value_type
			});

			// 获取实际值
			let actualValue = getValueFromData(field, formData, calculatedValues);
			let compareValue = value;

			console.log('实际值:', actualValue, '比较值:', compareValue);

			// 根据值类型处理比较值
			if (value_type === 'variable') {
				compareValue = getValueFromData(value, formData, calculatedValues);
				console.log('变量类型比较值更新为:', compareValue);
			}

			// 执行比较
			const result = compareValues(actualValue, operator, compareValue);
			console.log('比较结果:', result);
			return result;
		});

		// 根据逻辑关系返回结果
		if (logic === 'or') {
			const finalResult = results.some(result => result);
			console.log('OR逻辑最终结果:', finalResult);
			return finalResult;
		} else {
			const finalResult = results.every(result => result);
			console.log('AND逻辑最终结果:', finalResult);
			return finalResult;
		}
	}

	console.log('无有效条件，返回true');
	return true;
}

/**
 * 从数据中获取值
 */
function getValueFromData(field, formData, calculatedValues) {
	if (!field) return undefined;

	// 支持嵌套字段，如 'user.department'
	const fields = field.split('.');
	let value = {
		...formData,
		...calculatedValues
	};

	console.log('获取字段值:', field, '数据源:', value);

	for (const f of fields) {
		if (value && typeof value === 'object' && f in value) {
			value = value[f];
			console.log('字段路径:', f, '当前值:', value);
		} else {
			console.log('字段不存在:', f, '在当前对象:', value);
			return undefined;
		}
	}

	console.log('最终字段值:', value);
	return value;
}

/**
 * 比较值
 */
function compareValues(actualValue, operator, compareValue) {
	console.log('比较值:', {
		actualValue,
		operator,
		compareValue
	});

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
 * 模拟流程执行
 */
async function simulateProcess(processDefinition, formData, calculatedValues, userInfo, vk, db) {
	const hrmService = new HrmService(vk, db);
	const employeeInfo = formData.employeeInfo;

	const simulation = {
		start_time: new Date().toISOString(),
		total_nodes: 0,
		estimated_duration: 0,
		nodes: [],
		path: [],
		variables: {
			...formData,
			...calculatedValues,
			applicant_id: employeeInfo.employee_id,
			applicant_name: employeeInfo.employee_name,
			applicant_department: employeeInfo.department_name || '',
			simulate_time: Date.now()
		}
	};

	console.log('开始模拟流程，变量:', simulation.variables);

	// 查找开始节点
	const startNode = processDefinition.nodes.find(node => node.node_type === 'start');
	if (!startNode) {
		throw new Error('流程定义中未找到开始节点');
	}

	console.log('找到开始节点:', startNode.node_key);

	// 开始模拟
	await simulateNode(startNode, processDefinition, simulation, employeeInfo, vk, db);

	// 计算统计信息
	simulation.total_nodes = simulation.nodes.length;
	simulation.estimated_duration = calculateEstimatedDuration(simulation.nodes);

	console.log('模拟完成，总节点数:', simulation.total_nodes, '路径:', simulation.path);

	return simulation;
}

/**
 * 模拟节点执行 - 修复版本
 */
async function simulateNode(currentNode, processDefinition, simulation, employeeInfo, vk, db) {
	// 避免无限循环
	if (simulation.nodes.length > 20) {
		console.warn('流程节点过多，可能存在循环，停止模拟');
		return;
	}

	console.log(`模拟节点: ${currentNode.node_key} (${currentNode.node_name})`);

	const nodeInfo = {
		node_key: currentNode.node_key,
		node_name: currentNode.node_name,
		node_type: currentNode.node_type,
		estimated_assignee: null,
		assignee_type: currentNode.assignee_type,
		assignee_value: currentNode.assignee_value,
		duration_estimate: currentNode.time_limit || 0,
		actions: currentNode.actions || [],
		candidate_users: currentNode.candidate_users || [],
		candidate_groups: currentNode.candidate_groups || [],
		conditions: [],
		next_node_keys: []
	};

	// 如果是任务节点，估算负责人
	if (currentNode.node_type === 'userTask' || currentNode.node_type === 'approval') {
		nodeInfo.estimated_assignee = await estimateAssignee(currentNode, simulation.variables, employeeInfo, vk,
			db);
	}

	// 记录节点
	simulation.nodes.push(nodeInfo);
	simulation.path.push(currentNode.node_key);

	// 如果是结束节点，停止模拟
	if (currentNode.node_type === 'end') {
		nodeInfo.is_final = true;
		console.log('到达结束节点，停止模拟');
		return;
	}

	// 处理下一节点
	const nextNodes = currentNode.next_nodes || [];
	console.log(`节点 ${currentNode.node_key} 的下一节点配置:`, nextNodes);

	if (nextNodes.length === 0) {
		console.warn('节点没有配置下一节点:', currentNode.node_key);
		return;
	}

	// 评估下一节点条件
	let nextNodeKey = null;
	const availablePaths = [];

	for (const nextConfig of nextNodes) {
		const conditionInfo = {
			target_node: nextConfig.node_key,
			condition_rule: nextConfig.condition_rule_code,
			is_default: nextConfig.default_path || false,
			matched: false
		};

		console.log(
			`评估下一节点 ${nextConfig.node_key}, 条件规则: ${nextConfig.condition_rule_code}, 默认路径: ${nextConfig.default_path}`
		);

		// 如果是默认路径
		if (nextConfig.default_path) {
			conditionInfo.matched = true;
			availablePaths.push(nextConfig.node_key);
			console.log(`默认路径可用: ${nextConfig.node_key}`);
		}
		// 如果有条件规则
		else if (nextConfig.condition_rule_code) {
			// 在试算中，我们假设审批操作都是同意的
			const tempVariables = {
				...simulation.variables,
				action: 'approve' // 假设审批操作是同意
			};

			const matched = await evaluateConditionRule(nextConfig.condition_rule_code, tempVariables, {}, db);
			conditionInfo.matched = matched;
			if (matched) {
				availablePaths.push(nextConfig.node_key);
				console.log(`条件规则匹配: ${nextConfig.node_key}`);
			} else {
				console.log(`条件规则不匹配: ${nextConfig.node_key}`);
			}
		}
		// 没有条件，直接通过
		else {
			conditionInfo.matched = true;
			availablePaths.push(nextConfig.node_key);
			console.log(`无条件路径可用: ${nextConfig.node_key}`);
		}

		nodeInfo.conditions.push(conditionInfo);
		nodeInfo.next_node_keys.push(nextConfig.node_key);
	}

	console.log(`可用路径: ${availablePaths.join(', ')}`);

	// 选择下一节点
	if (availablePaths.length > 0) {
		// 优先选择非默认路径
		const nonDefaultPaths = nextNodes.filter(config =>
			!config.default_path && availablePaths.includes(config.node_key)
		);

		if (nonDefaultPaths.length > 0) {
			nextNodeKey = nonDefaultPaths[0].node_key;
			console.log(`选择非默认路径: ${nextNodeKey}`);
		} else {
			// 使用默认路径
			const defaultPath = nextNodes.find(config => config.default_path);
			if (defaultPath) {
				nextNodeKey = defaultPath.node_key;
				console.log(`使用默认路径: ${nextNodeKey}`);
			} else {
				// 没有默认路径，使用第一个可用路径
				nextNodeKey = availablePaths[0];
				console.log(`使用第一个可用路径: ${nextNodeKey}`);
			}
		}
	}

	if (!nextNodeKey) {
		console.error(`没有找到可用的下一节点: ${currentNode.node_key}, 可用路径: ${availablePaths.join(', ')}`);
		// 在试算中，如果找不到下一节点，我们选择第一个配置的节点继续模拟
		if (nextNodes.length > 0) {
			nextNodeKey = nextNodes[0].node_key;
			console.warn(`强制使用第一个配置节点继续模拟: ${nextNodeKey}`);
		} else {
			console.error('完全没有配置下一节点，停止模拟');
			return;
		}
	}

	// 查找下一节点定义
	const nextNode = processDefinition.nodes.find(node => node.node_key === nextNodeKey);
	if (!nextNode) {
		console.error('下一节点不存在:', nextNodeKey, '可用节点:', processDefinition.nodes.map(n => n.node_key));
		return;
	}

	// 递归模拟下一节点
	await simulateNode(nextNode, processDefinition, simulation, employeeInfo, vk, db);
}

/**
 * 估算任务负责人(默认加上申请人部门主管审核)
 */
async function estimateAssignee(node, variables, employeeInfo, vk, db) {
	const assigneeType = node.assignee_type;
	const assigneeValue = node.assignee_value;

	console.log('确定负责人，类型:', assigneeType, '值:', assigneeValue);

	let assignee = null;
	let assigneeName = null;

	switch (assigneeType) {
		case 'user':
			assignee = assigneeValue;
			assigneeName = await getUserDisplayName(assigneeValue, vk, db);
			break;
		case 'role':
			console.log('根据角色查找用户:', assigneeValue);
			const roleUsers = await getUsersByRole(assigneeValue, vk, db);
			console.log('角色用户查询结果:', roleUsers);
			if (roleUsers && roleUsers.length > 0) {
				assignee = roleUsers[0].username;
				assigneeName = roleUsers[0].nickname;
			}
			break;
		case 'department':
			console.log('根据部门查找用户:', assigneeValue);
			const deptUser = await getUsersByDepartment(employeeInfo);
			console.log('部门用户查询结果:', deptUser);
			if (deptUser) {
				assignee = deptUser.manager_id;
				assigneeName = deptUser.manager_name;
			}
			break;
		case 'variable':
			console.log('从变量中获取负责人:', assigneeValue);
			assignee = getValueFromData(assigneeValue, variables, {});
			assigneeName = await getUserDisplayName(assignee, vk, db);
			break;
		case 'previous':
			console.log('获取上一节点处理人');
			// 在试算中暂时使用申请人
			assignee = employeeInfo.employee_id;
			assigneeName = employeeInfo.employee_name;
			break;
		default:
			console.warn('未知的负责人类型:', assigneeType);
	}

	// 如果没有找到负责人，使用申请人作为默认负责人
	if (!assignee) {
		console.log('未找到负责人，使用申请人作为默认');
		assignee = employeeInfo.employee_id;
		assigneeName = employeeInfo.employee_name;
	}

	console.log('最终负责人:', {
		assignee,
		assigneeName
	});

	return {
		id: assignee,
		name: assigneeName,
		type: assigneeType
	};
}

/**
 * 获取用户显示名称
 */
async function getUserDisplayName(userId, vk, db) {
	if (!userId) return '未知用户';
	try {
		const userRes = await db.collection('uni-id-users').where({
			username: userId
		}).get();
		if (userRes.data && userRes.data.length > 0) {
			return userRes.data[0].nickname || userRes.data[0].username || userId;
		}
		return userId;
	} catch (error) {
		return userId;
	}
}

/**
 * 根据角色获取用户
 */
async function getUsersByRole(role, vk, db) {
	try {
		const usersRes = await db.collection('uni-id-users')
			.where({
				role: role
			})
			.get();
		return usersRes.data || [];
	} catch (error) {
		console.error('根据角色获取用户失败:', error);
		return [];
	}
}

/**
 * 根据部门获取用户
 */
async function getUsersByDepartment(employeeInfo) {
	try {
		if (employeeInfo.department_manager_id == employeeInfo.employee_id) {
			return {
				manager_id: employeeInfo.manager_id,
				manager_name: employeeInfo.manager_name
			}
		}

		if (employeeInfo.department_manager_id && employeeInfo.department_manager_name) {
			return {
				manager_id: employeeInfo.department_manager_id,
				manager_name: employeeInfo.department_manager_name
			}
		}

		return {}

	} catch (error) {
		console.error('根据部门获取用户失败:', error);
		return [];
	}
}

/**
 * 计算预计时长
 */
function calculateEstimatedDuration(nodes) {
	let totalHours = 0;

	nodes.forEach(node => {
		if (node.node_type === 'userTask' || node.node_type === 'approval') {
			totalHours += node.duration_estimate || 24;
		}
	});

	return {
		total_hours: totalHours,
		total_days: Math.ceil(totalHours / 24),
		formatted: formatDuration(totalHours)
	};
}

/**
 * 格式化时长
 */
function formatDuration(hours) {
	const days = Math.floor(hours / 24);
	const remainingHours = hours % 24;

	if (days > 0 && remainingHours > 0) {
		return `${days}天${remainingHours}小时`;
	} else if (days > 0) {
		return `${days}天`;
	} else {
		return `${hours}小时`;
	}
}