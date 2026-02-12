// cloudfunctions/workflow-seal/index.js
'use strict';
const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
  const uid = context.APP_PLATFORM === 'web' ? event.uid : context.uid;
  
  try {
    const { data = {}, action } = event;
    
    switch (action) {
      case 'add':
        return await createSealApplication(data, uid);
      case 'getList':
        return await getSealApplicationList(data, uid);
      case 'delete':
        return await deleteSealApplication(data, uid);
      case 'cancel':
        return await cancelSealApplication(data, uid);
      default:
        return { code: 400, message: '未知操作' };
    }
  } catch (error) {
    console.error('用印申请单操作失败:', error);
    return { code: 500, message: error.message || '操作失败' };
  }
};

// 创建用印申请单
async function createSealApplication(data, uid) {
  const { form_data, status = 'draft', id } = data;
  
  // 验证必填字段
  if (!form_data || !form_data.seal_type || !form_data.file_name || !form_data.file_type) {
    return { code: 400, message: '请填写完整的用印信息' };
  }
  
  // 获取用户信息
  const userRes = await db.collection('uni-id-users').doc(uid).get();
  if (!userRes.data || userRes.data.length === 0) {
    return { code: 400, message: '用户信息不存在' };
  }
  
  const userInfo = userRes.data[0];
  const now = Date.now();
  
  // 构建申请记录
  const applicationRecord = {
    form_type_code: 'SEAL_APPLICATION',
    applicant_id: userInfo._id,
    applicant_name: userInfo.nickname || userInfo.username,
    applicant_department: userInfo.department || '',
    applicant_level: userInfo.level || '',
    applicant_roles: userInfo.roles || [],
    title: `用印申请-${form_data.file_name}`,
    form_data: form_data,
    calculated_values: {
      total_copies: parseInt(form_data.copies) || 1
    },
    status: status,
    update_date: now,
    updat_id: uid
  };

  let result;
  
  // 更新或新增
  if (id) {
    // 检查申请单是否存在且为草稿状态
    const existingApp = await db.collection('bpmn-application-form').doc(id).get();
    if (!existingApp.data || existingApp.data.length === 0) {
      return { code: 400, message: '申请单不存在' };
    }
    
    const appData = existingApp.data[0];
    if (appData.status !== 'draft') {
      return { code: 400, message: '只能修改草稿状态的申请单' };
    }
    
    if (appData.applicant_id !== uid) {
      return { code: 403, message: '只能修改自己的申请单' };
    }
    
    result = await db.collection('bpmn-application-form').doc(id).update(applicationRecord);
    
    if (result.updated === 0) {
      return { code: 500, message: '更新申请单失败' };
    }
  } else {
    // 新增记录
    applicationRecord.create_date = now;
    applicationRecord.create_id = uid;
    
    const addRes = await db.collection('bpmn-application-form').add(applicationRecord);
    
    if (!addRes.id) {
      return { code: 500, message: '创建申请单失败' };
    }
    
    applicationRecord._id = addRes.id;
    result = { id: addRes.id };
  }
  
  // 如果是提交状态，启动流程
  if (status === 'pending') {
    try {
      const applicationId = id || result.id;
      const processRes = await uniCloud.callFunction({
        name: 'bpmn-application-form',
        data: {
          action: 'submit',
          application_id: applicationId
        }
      });
      
      if (processRes.result.code !== 200) {
        // 如果流程启动失败，回滚申请单状态
        await db.collection('bpmn-application-form').doc(applicationId).update({
          status: 'draft',
          update_date: Date.now()
        });
        return { 
          code: 500, 
          message: '提交失败: ' + (processRes.result.message || '流程启动失败') 
        };
      }
    } catch (processError) {
      // 流程启动异常，回滚状态
      const applicationId = id || result.id;
      await db.collection('bpmn-application-form').doc(applicationId).update({
        status: 'draft',
        update_date: Date.now()
      });
      return { code: 500, message: '流程启动异常' };
    }
  }
  
  return {
    code: 0,
    message: status === 'pending' ? '提交成功' : (id ? '更新成功' : '创建成功'),
    data: {
      id: id || result.id
    }
  };
}

// 获取用印申请单列表
async function getSealApplicationList(data, uid) {
  const { 
    page = 1, 
    pageSize = 20, 
    where = {},
    orderBy = 'create_date desc'
  } = data;
  
  // 构建查询条件
  let query = db.collection('bpmn-application-form').where({
    form_type_code: 'SEAL_APPLICATION'
  });
  
  // 添加过滤条件
  const whereConditions = [];
  
  // 文件名称模糊查询
  if (where['form_data.file_name']) {
    whereConditions.push({
      'form_data.file_name': dbCmd.regExp({
        regexp: where['form_data.file_name'],
        options: 'i'
      })
    });
  }
  
  // 用印类型精确查询
  if (where['form_data.seal_type']) {
    whereConditions.push({
      'form_data.seal_type': where['form_data.seal_type']
    });
  }
  
  // 状态查询
  if (where.status) {
    whereConditions.push({
      status: where.status
    });
  }
  
  // 申请人查询
  if (where.applicant_id) {
    whereConditions.push({
      applicant_id: where.applicant_id
    });
  }
  
  // 创建时间范围查询
  if (where.create_date && where.create_date.$gte && where.create_date.$lte) {
    whereConditions.push({
      create_date: dbCmd.gte(where.create_date.$gte).and(dbCmd.lte(where.create_date.$lte))
    });
  }
  
  // 应用所有条件
  if (whereConditions.length > 0) {
    query = query.where(dbCmd.and(...whereConditions));
  }
  
  // 执行查询
  const countRes = await query.count();
  const listRes = await query
    .orderBy(orderBy)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  return {
    code: 0,
    data: {
      rows: listRes.data,
      total: countRes.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  };
}

// 删除用印申请单
async function deleteSealApplication(data, uid) {
  const { id } = data;
  
  if (!id) {
    return { code: 400, message: '申请单ID不能为空' };
  }
  
  // 检查申请单是否存在
  const applicationRes = await db.collection('bpmn-application-form').doc(id).get();
  if (!applicationRes.data || applicationRes.data.length === 0) {
    return { code: 400, message: '申请单不存在' };
  }
  
  const application = applicationRes.data[0];
  
  // 检查权限：只能删除自己的草稿
  if (application.applicant_id !== uid) {
    return { code: 403, message: '只能删除自己的申请单' };
  }
  
  if (application.status !== 'draft') {
    return { code: 400, message: '只能删除草稿状态的申请单' };
  }
  
  // 删除申请单
  const deleteRes = await db.collection('bpmn-application-form').doc(id).remove();
  
  if (deleteRes.deleted === 0) {
    return { code: 500, message: '删除失败' };
  }
  
  return {
    code: 0,
    message: '删除成功'
  };
}

// 撤销用印申请单
async function cancelSealApplication(data, uid) {
  const { id } = data;
  
  if (!id) {
    return { code: 400, message: '申请单ID不能为空' };
  }
  
  // 检查申请单是否存在
  const applicationRes = await db.collection('bpmn-application-form').doc(id).get();
  if (!applicationRes.data || applicationRes.data.length === 0) {
    return { code: 400, message: '申请单不存在' };
  }
  
  const application = applicationRes.data[0];
  
  // 检查权限：只能撤销自己的待审批申请
  if (application.applicant_id !== uid) {
    return { code: 403, message: '只能撤销自己的申请单' };
  }
  
  if (application.status !== 'pending') {
    return { code: 400, message: '只能撤销待审批状态的申请单' };
  }
  
  const now = Date.now();
  
  // 更新申请单状态
  const updateRes = await db.collection('bpmn-application-form').doc(id).update({
    status: 'cancelled',
    update_date: now,
    updat_id: uid
  });
  
  if (updateRes.updated === 0) {
    return { code: 500, message: '撤销失败' };
  }
  
  // 终止相关流程实例
  await db.collection('bpmn-instance')
    .where({ application_id: id })
    .update({
      status: 'terminated',
      end_time: now
    });
  
  // 取消待处理任务
  await db.collection('bpmn-task')
    .where({ 
      application_id: id,
      status: 'pending'
    })
    .update({
      status: 'cancelled',
      complete_time: now
    });
  
  return {
    code: 0,
    message: '撤销成功'
  };
}