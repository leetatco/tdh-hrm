// cloudfunctions/admin/bpmn/task/sys/complete.js
module.exports = {
	/**
	 * 完成任务并推进流程
	 * @url admin/bpmn/task/pub/complete 前端调用的url参数地址
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
			uid,
			userInfo
		} = data;
		let res = {
			code: 0,
			msg: ''
		};
		const {
			task_id,
			action,
			comment,
			transfer_user,
			applicationDate
		} = data;

		if (!task_id) {
			return {
				code: -1,
				msg: '任务ID不能为空'
			};
		}

		try {
			// 1. 获取任务详情
			const taskRes = await vk.baseDao.findById({
				dbName: "bpmn-task",
				id: task_id
			});

			if (!taskRes) {
				return {
					code: -1,
					msg: '任务不存在'
				};
			}

			const task = taskRes;


			// 2. 权限检查 - 只有处理人或管理员可以操作
			if (task.assignee !== userInfo.username && !userInfo.role.includes('admin')) {
				return {
					code: -1,
					msg: '无权处理此任务'
				};
			}

			// 3. 记录任务完成历史
			await vk.baseDao.add({
				dbName: "bpmn-task-history",
				dataJson: {
					task_id: task_id,
					application_id: task.application_id,
					operator_id: userInfo.username,
					operator_name: userInfo.nickname,
					action: action,
					comment: comment,
					transfer_user: transfer_user,
					operation_time: Date.now(),
					task_snapshot: task
				}
			});

			// 4. 根据操作类型处理任务
			let nextTask = null;

			//通知内容处理
			const title = applicationDate.title || '';
			let content = `${title}需要审批，请及时处理`;
			let recipients = [];

			if (action === 'transfer' && transfer_user) {
				// 转交任务 - 修改当前任务的负责人，不改变任务状态
				await handleTaskTransfer(task_id, transfer_user, userInfo, vk, db);
				recipients.push(transfer_user);
				await sendTaskNotification(task.application_id, task, applicationDate.form_type_code,
					recipients, title, content, vk);
				res.msg = '任务转交成功';
				// 转交操作不更新任务状态，直接返回
				return res;

			} else if (action === 'return') {
				// 退回给申请人
				nextTask = await handleTaskReturn(task, userInfo, vk, db);
				content = `${title}已退回，请知悉！`;
				recipients.push(applicationDate.applicant_id);
				await sendTaskNotification(task.application_id, task, applicationDate.form_type_code,
					recipients, title, content, vk);
				res.msg = '已退回给申请人';

			} else if (action === 'approve' || action === 'reject') {
				// 正常审批 - 推进到下一个任务或结束流程
				nextTask = await handleTaskComplete(task, action, userInfo, vk, db);
				res.msg = action === 'approve' ? '审批通过' : '审批拒绝';

			} else {
				return {
					code: -1,
					msg: '不支持的操作类型'
				};
			}

			// 5. 更新任务状态
			await vk.baseDao.updateById({
				dbName: "bpmn-task",
				id: task_id,
				dataJson: {
					status: 'completed',
					action: action,
					comment: comment,
					complete_time: Date.now(),
					operator_id: userInfo.username,
					operator_name: userInfo.nickname
				}
			});

			// 6. 如果有下一个任务，发送通知
			if (nextTask) {
				await sendTaskNotification(task.application_id, nextTask, applicationDate.form_type_code,
					'签核任务', vk);
				res.data = {
					next_task: nextTask
				};
			} else {
				// 流程结束，更新申请状态
				const finalStatus = action === 'approve' ? 'approved' : 'rejected';
				await vk.baseDao.updateById({
					dbName: "bpmn-application-form",
					id: task.application_id,
					dataJson: {
						status: finalStatus,
						current_task: null,
						update_date: Date.now()
					}
				});

				// 更新流程实例状态
				await vk.baseDao.updateById({
					dbName: "bpmn-instance",
					id: task.instance_id,
					dataJson: {
						status: 'completed',
						end_time: Date.now(),
						current_tasks: []
					}
				});

				//通知申请人已通过
				content = action === 'approve' ? `${title}已通过，请知悉！` : `${title}未通过，请知悉！`;

				recipients.push(applicationDate.applicant_id);
				await sendTaskNotification(task.application_id, task, applicationDate.form_type_code,
					recipients, title, content, vk);

				res.data = {
					process_completed: true,
					final_status: finalStatus
				};
			}

		} catch (error) {
			return {
				code: -1,
				msg: error.message
			};
		}

		return res;
	}
}

/**
 * 处理任务转交
 */
async function handleTaskTransfer(taskId, transfer_user, userInfo, vk, db) {
	// 获取转交目标的用户信息
	const targetUserRes = await db.collection('uni-id-users')
		.where({
			username: transfer_user
		})
		.get();

	if (!targetUserRes.data || targetUserRes.data.length === 0) {
		throw new Error('转交目标用户不存在');
	}

	const targetUser = targetUserRes.data[0];

	// 更新任务负责人，但保持任务状态为pending
	const updateData = {
		assignee: transfer_user,
		assignee_name: targetUser.nickname || targetUser.username,
		update_date: Date.now()
	};

	// 记录转交前的负责人信息
	const currentTask = await vk.baseDao.findById({
		dbName: "bpmn-task",
		id: taskId
	});

	if (currentTask) {
		updateData
			.previous_assignee = currentTask.assignee;
		updateData
			.previous_assignee_name = currentTask.assignee_name;
		updateData
			.transfer_time = Date.now();
		updateData
			.transfer_by = userInfo.username;
	}

	await vk.baseDao.updateById({
		dbName: "bpmn-task",
		id: taskId,
		dataJson: updateData
	});

	// 更新流程实例的当前任务信息
	if (currentTask) {
		await vk.baseDao.updateById({
			dbName: "bpmn-instance",
			id: currentTask.instance_id,
			dataJson: {
				'current_tasks.0.assignee': transfer_user,
				'current_tasks.0.assignee_name': targetUser.nickname || targetUser.username,
				update_date: Date.now()
			}
		});
	}

	return {
		success: true
	};
}

/**
 * 处理任务退回
 */
async function handleTaskReturn(currentTask, userInfo, vk, db) {
	// 退回时创建新的任务给申请人
	const applicationRes = await vk.baseDao.findById({
		dbName: "bpmn-application-form",
		id: currentTask.application_id
	});

	if (!applicationRes) {
		throw new Error('申请记录不存在');
	}

	const application = applicationRes;

	// 创建退回任务
	const returnTaskData = {
		instance_id: currentTask.instance_id,
		application_id: currentTask.application_id,
		task_key: 'return_task',
		task_name: '申请退回处理',
		node_type: 'return',
		assignee: application.applicant_id,
		assignee_name: application.applicant_name,
		assignee_type: 'user',
		status: 'pending',
		actions: ['resubmit', 'withdraw'],
		sequence: currentTask.sequence, // 保持相同顺序，表示需要重新处理
		create_time: Date.now(),
		task_data: {
			return_reason: '审批退回',
			returned_from: currentTask.task_name,
			original_task_id: currentTask._id
		}
	};

	const taskRes = await vk.baseDao.add({
		dbName: "bpmn-task",
		dataJson: returnTaskData
	});

	// 更新流程实例的当前任务
	await vk.baseDao.updateById({
		dbName: "bpmn-instance",
		id: currentTask.instance_id,
		dataJson: {
			current_tasks: [{
				task_id: taskRes.id,
				task_name: returnTaskData.task_name,
				assignee: returnTaskData.assignee,
				create_time: Date.now()
			}],
			update_date: Date.now()
		}
	});

	// 更新申请记录的当前任务
	await vk.baseDao.updateById({
		dbName: "bpmn-application-form",
		id: currentTask.application_id,
		dataJson: {
			current_task: returnTaskData.task_name,
			update_date: Date.now()
		}
	});

	return {
		task_id: taskRes.id,
		task_name: returnTaskData.task_name,
		assignee: {
			id: returnTaskData.assignee,
			name: returnTaskData.assignee_name
		}
	};
}

/**
 * 处理任务完成并推进到下一个任务
 */
async function handleTaskComplete(currentTask, action, userInfo, vk, db) {
	// 如果是拒绝，直接结束流程
	if (action === 'reject') {
		return null;
	}

	// 获取下一个任务（按顺序）
	const nextTaskRes = await db.collection('bpmn-task')
		.where({
			instance_id: currentTask.instance_id,
			sequence: currentTask.sequence + 1,
			status: 'waiting'
		})
		.get();

	if (!nextTaskRes.data || nextTaskRes.data.length === 0) {
		return null; // 没有下一个任务，流程结束
	}

	const nextTask = nextTaskRes.data[0];

	// 更新下一个任务状态为pending
	await vk.baseDao.updateById({
		dbName: "bpmn-task",
		id: nextTask._id,
		dataJson: {
			status: 'pending',
			update_date: Date.now()
		}
	});

	// 更新流程实例的当前任务
	await vk.baseDao.updateById({
		dbName: "bpmn-instance",
		id: currentTask.instance_id,
		dataJson: {
			current_tasks: [{
				task_id: nextTask._id,
				task_name: nextTask.task_name,
				assignee: nextTask.assignee,
				create_time: Date.now()
			}],
			update_date: Date.now()
		}
	});

	// 更新申请记录的当前任务
	await vk.baseDao.updateById({
		dbName: "bpmn-application-form",
		id: currentTask.application_id,
		dataJson: {
			current_task: nextTask.task_name,
			update_date: Date.now()
		}
	});

	return {
		task_id: nextTask._id,
		task_name: nextTask.task_name,
		assignee: {
			id: nextTask.assignee,
			name: nextTask.assignee_name
		}
	};
}

/**
 * 发送任务通知给处理人
 */
async function sendTaskNotification(applicationId, task, form_type_code, recipients = [], title, content, vk) {
	if (!task) return;

	try {
		await vk.callFunction({
			url: 'admin/bpmn/notification/pub/add',
			title: '发送通知...',
			data: {
				type: 'task_assigned',
				title: title,
				content: content,
				recipients: recipients,
				data: {
					application_id: applicationId,
					task_id: task.task_id,
					task_name: task.task_name,
					form_type: form_type_code,
					timestamp: Date.now()
				}
			}
		});

		console.log(`已发送通知给任务处理人: ${task.assignee.name}`);
	} catch (error) {
		console.error('发送任务通知失败:', error);
	}
}