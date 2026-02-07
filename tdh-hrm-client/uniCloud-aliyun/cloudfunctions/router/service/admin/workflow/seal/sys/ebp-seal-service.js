'use strict';
const db = uniCloud.database();

exports.main = async (event, context) => {
  const { action, params } = event;
  
  const serviceMap = {
    'createSealApplication': createSealApplication,
    'updateSealApplication': updateSealApplication,
    'getSealApplications': getSealApplications,
    'getSealApplicationDetail': getSealApplicationDetail,
    'cancelSealApplication': cancelSealApplication
  };
  
  if (serviceMap[action]) {
    return await serviceMap[action](params);
  }
  
  return { code: 404, message: '未知操作' };
};

/**
 * 创建用印申请
 */
async function createSealApplication(params) {
  const { formData, applicantInfo, status = 'draft' } = params;
  
  try {
    // 验证表单数据
    const validationResult = await validateSealFormData(formData);
    if (!validationResult.valid) {
      return { code: 400, message: validationResult.errors.join(', ') };
    }
    
    // 创建申请记录
    const application = {
      _id: `seal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      form_type_code: 'SEAL_APPLICATION',
      title: `用印申请-${formData.file_name}`,
      form_data: formData,
      applicant_id: applicantInfo.uid,
      applicant_name: applicantInfo.username,
      status: status,
      create_date: Date.now(),
      update_date: Date.now()
    };
    
    await db.collection('ebp_application_form').add(application);
    
    // 如果是提交状态，启动流程
    if (status === 'pending') {
      const processResult = await startSealProcess(application, applicantInfo);
      if (processResult.code !== 200) {
        // 如果启动流程失败，更新申请状态为草稿
        await db.collection('ebp_application_form').doc(application._id).update({
          status: 'draft',
          update_date: Date.now()
        });
        return processResult;
      }
      
      // 更新申请记录中的流程实例ID
      await db.collection('ebp_application_form').doc(application._id).update({
        process_instance_id: processResult.data.processInstanceId,
        current_node_key: processResult.data.currentNodeKey
      });
    }
    
    return {
      code: 200,
      data: {
        applicationId: application._id,
        message: status === 'draft' ? '草稿保存成功' : '申请提交成功'
      }
    };
    
  } catch (error) {
    return {
      code: 500,
      message: error.message
    };
  }
}

/**
 * 启动用印申请流程
 */
async function startSealProcess(application, applicantInfo) {
  const processParams = {
    formTypeCode: 'SEAL_APPLICATION',
    formData: application.form_data,
    applicantInfo: applicantInfo
  };
  
  const processResult = await uniCloud.callFunction({
    name: 'ebp-process-engine',
    data: {
      action: 'startProcess',
      params: processParams
    }
  });
  
  return processResult.result;
}

/**
 * 验证用印表单数据
 */
async function validateSealFormData(formData) {
  const errors = [];
  
  if (!formData.seal_type) {
    errors.push('请选择用印类型');
  }
  
  if (!formData.file_name || formData.file_name.trim().length === 0) {
    errors.push('请输入文件名称');
  }
  
  if (!formData.file_type) {
    errors.push('请选择文件类型');
  }
  
  if (!formData.copies || formData.copies < 1) {
    errors.push('用印份数必须大于0');
  }
  
  if (!formData.purpose || formData.purpose.trim().length === 0) {
    errors.push('请输入用印事由');
  }
  
  if (formData.expected_date && formData.expected_date < Date.now()) {
    errors.push('期望用印日期不能早于当前日期');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * 更新用印申请
 */
async function updateSealApplication(params) {
  const { id, formData, status, applicantInfo } = params;
  
  try {
    const application = await db.collection('ebp_application_form').doc(id).get();
    if (!application.data) {
      return { code: 404, message: '申请记录不存在' };
    }
    
    // 检查权限
    if (application.data.applicant_id !== applicantInfo.uid) {
      return { code: 403, message: '无权操作此申请' };
    }
    
    // 检查状态
    if (application.data.status !== 'draft') {
      return { code: 400, message: '只有草稿状态的申请可以编辑' };
    }
    
    // 验证表单数据
    if (formData) {
      const validationResult = await validateSealFormData(formData);
      if (!validationResult.valid) {
        return { code: 400, message: validationResult.errors.join(', ') };
      }
    }
    
    const updateData = {
      update_date: Date.now()
    };
    
    if (formData) {
      updateData.form_data = formData;
      updateData.title = `用印申请-${formData.file_name}`;
    }
    
    if (status) {
      updateData.status = status;
      
      // 如果是提交状态，启动流程
      if (status === 'pending') {
        const processResult = await startSealProcess({
          ...application.data,
          form_data: formData || application.data.form_data
        }, applicantInfo);
        
        if (processResult.code !== 200) {
          return processResult;
        }
        
        updateData.process_instance_id = processResult.data.processInstanceId;
        updateData.current_node_key = processResult.data.currentNodeKey;
      }
    }
    
    await db.collection('ebp_application_form').doc(id).update(updateData);
    
    return {
      code: 200,
      data: {
        message: status === 'pending' ? '申请提交成功' : '更新成功'
      }
    };
    
  } catch (error) {
    return {
      code: 500,
      message: error.message
    };
  }
}

/**
 * 获取用印申请列表
 */
async function getSealApplications(params) {
  const { userId, page = 1, pageSize = 10, status, keyword } = params;
  
  try {
    let where = {
      form_type_code: 'SEAL_APPLICATION'
    };
    
    // 根据用户角色过滤
    const userInfo = await getUserInfo(userId);
    if (!userInfo.roles.includes('admin') && !userInfo.roles.includes('seal_manager')) {
      where.applicant_id = userId;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (keyword) {
      where.title = new RegExp(keyword, 'i');
    }
    
    const countResult = await db.collection('ebp_application_form')
      .where(where)
      .count();
    
    const listResult = await db.collection('ebp_application_form')
      .where(where)
      .orderBy('create_date', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    // 获取流程信息
    const applicationsWithProcess = await Promise.all(
      listResult.data.map(async (app) => {
        let processInfo = {};
        if (app.process_instance_id) {
          const process = await db.collection('ebp_bpmn_instance')
            .doc(app.process_instance_id)
            .get();
          if (process.data) {
            processInfo = {
              current_task: process.data.current_node_key,
              process_status: process.data.status
            };
          }
        }
        return { ...app, ...processInfo };
      })
    );
    
    return {
      code: 200,
      data: {
        list: applicationsWithProcess,
        total: countResult.total,
        page: page,
        pageSize: pageSize
      }
    };
    
  } catch (error) {
    return {
      code: 500,
      message: error.message
    };
  }
}

/**
 * 撤销用印申请
 */
async function cancelSealApplication(params) {
  const { id, userId, reason } = params;
  
  try {
    const application = await db.collection('ebp_application_form').doc(id).get();
    if (!application.data) {
      return { code: 404, message: '申请记录不存在' };
    }
    
    // 检查权限
    if (application.data.applicant_id !== userId) {
      return { code: 403, message: '无权操作此申请' };
    }
    
    // 检查状态
    if (application.data.status !== 'pending') {
      return { code: 400, message: '只有审批中的申请可以撤销' };
    }
    
    // 更新申请状态
    await db.collection('ebp_application_form').doc(id).update({
      status: 'cancelled',
      update_date: Date.now(),
      cancel_reason: reason
    });
    
    // 如果有流程实例，终止流程
    if (application.data.process_instance_id) {
      await db.collection('ebp_bpmn_instance')
        .doc(application.data.process_instance_id)
        .update({
          status: 'cancelled',
          end_time: Date.now()
        });
      
      // 更新相关任务状态
      await db.collection('ebp_bpmn_task')
        .where({
          instance_id: application.data.process_instance_id,
          status: 'pending'
        })
        .update({
          status: 'cancelled',
          complete_time: Date.now(),
          action: 'cancel'
        });
    }
    
    return {
      code: 200,
      data: {
        message: '申请撤销成功'
      }
    };
    
  } catch (error) {
    return {
      code: 500,
      message: error.message
    };
  }
}