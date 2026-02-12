<template>
	<view class="page-body">
		<!-- 表格搜索组件 -->
		<vk-data-table-query v-model="queryForm1.formData" :columns="queryForm1.columns" @search="search">
			<template v-slot:_add_time>
				<vk-data-input-date-time v-model="queryForm1.formData._add_time"
					type="daterange"></vk-data-input-date-time>
			</template>
		</vk-data-table-query>

		<!-- 自定义按钮区域 -->
		<view class="button-group">
			<el-row>
				<el-button type="warning" size="small" icon="el-icon-refresh" @click="refresh" :loading="loading">
					刷新
				</el-button>
				<el-button type="primary" size="small" icon="el-icon-s-operation" @click="showBatchApproveDialog"
					v-if="table1.multipleSelection.length > 0">
					批量处理 ({{ table1.multipleSelection.length }})
				</el-button>
			</el-row>
		</view>

		<!-- 加载状态 -->
		<el-skeleton v-if="loading" :rows="10" animated />

		<!-- 表格组件 -->
		<vk-data-table v-else ref="table1" :action="table1.action" :columns="table1.columns"
			:query-form-param="queryForm1" :custom-right-btns="table1.customRightBtns" :selection="true" :row-no="true"
			:pagination="true" @current-change="currentChange" @selection-change="selectionChange" />

		<!-- 审批处理弹窗公共组件 -->
		<approve-handle-dialog v-model="approveDialog.show" :title="approveDialog.title" :task="currentTask"
			:application="currentApplication"
			:form-schema="getFormTypeSchema(currentApplication ? currentApplication.form_type_code : '')"
			:process-info="approveDialog.processFlow" :approval-history="approveDialog.approvalHistory"
			:form-type-configs="formTypeConfigs" :show-return-option="showReturnOption"
			:show-transfer-option="showTransferOption" :show-add-sign-option="showAddSignOption"
			:loading="approveLoading" @preview-file="previewFile" @download-file="downloadFile"
			@action-change="onActionChange" @submit="handleApproveSubmit" />

		<!-- 详情弹窗公共组件 -->
		<vk-data-dialog v-model="detailDialog.show" :title="detailDialog.title" width="900px">
			<approve-header-detail :detail-data="detailDialog.data"
				:form-schema="getFormTypeSchema(detailDialog.data ? detailDialog.data.form_type_code : '')"
				:process-info="detailDialog.processFlow" :status-history="detailDialog.approvalHistory"
				:current-tasks="detailDialog.currentTasks" :show-basic-info="true" :show-return-info="false"
				:show-approval-flow="true" :show-current-task="true" :show-handle-form="false"
				:form-type-configs="formTypeConfigs" @preview-file="previewFile" @download-file="downloadFile" />
			<template v-slot:footer>
				<el-button @click="detailDialog.show = false">关闭</el-button>
				<el-button type="primary" v-if="canHandleCurrentTask(detailDialog.data)"
					@click="handleTaskFromDetail(detailDialog.data)">立即处理</el-button>
				<el-button type="warning" v-if="hasReturnTask(detailDialog.data)"
					@click="handleReturnTaskFromDetail(detailDialog.data)">处理退回</el-button>
				<el-button type="danger" v-if="canWithdrawApplication(detailDialog.data)"
					@click="handleWithdrawApplication(detailDialog.data)">撤回申请</el-button>
			</template>
		</vk-data-dialog>

		<!-- 批量审批弹窗 -->
		<vk-data-dialog v-model="batchApproveDialog.show" title="批量审批" width="500px">
			<view class="batch-approve-content">
				<view class="batch-info">
					<el-alert type="info" :closable="false">
						已选择 {{ batchApproveDialog.selectedItems.length }} 个待办任务
					</el-alert>
				</view>
				<el-form :model="batchApproveForm" :rules="batchApproveRules" ref="batchApproveFormRef"
					label-width="100px">
					<el-form-item label="审批操作" prop="action" required>
						<el-radio-group v-model="batchApproveForm.action">
							<el-radio label="approve">批量同意</el-radio>
							<el-radio label="reject">批量驳回</el-radio>
						</el-radio-group>
					</el-form-item>
					<el-form-item label="审批意见" prop="comment" required>
						<el-input v-model="batchApproveForm.comment" type="textarea" :rows="3" placeholder="请输入统一的审批意见"
							maxlength="200" show-word-limit />
					</el-form-item>
				</el-form>
			</view>
			<template v-slot:footer>
				<el-button @click="batchApproveDialog.show = false">取消</el-button>
				<el-button type="primary" @click="handleBatchApprove" :loading="batchApproveLoading">确定</el-button>
			</template>
		</vk-data-dialog>

		<!-- 退回处理弹窗公共组件 -->
		<return-handle-dialog v-model="returnDialog.show" :title="returnDialog.title" :task="returnDialog.task"
			:application="returnDialog.application"
			:form-schema="getFormTypeSchema(returnDialog.application ? returnDialog.application.form_type_code : '')"
			:process-info="returnDialog.processFlow" :status-history="returnDialog.statusHistory"
			:form-type-configs="formTypeConfigs" :loading="returnLoading" @preview-file="previewFile"
			@download-file="downloadFile" @edit-application="editApplicationContent" @submit="handleReturnSubmit" />

		<!-- 撤回确认弹窗 -->
		<vk-data-dialog v-model="withdrawDialog.show" title="撤回申请确认" width="500px">
			<view class="withdraw-dialog-content">
				<el-alert type="warning" :closable="false" style="margin-bottom: 20px;">
					撤回申请后，将无法恢复，请谨慎操作！
				</el-alert>
				<el-form :model="withdrawForm" :rules="withdrawRules" ref="withdrawFormRef" label-width="100px">
					<el-form-item label="撤回原因" prop="reason" required>
						<el-input v-model="withdrawForm.reason" type="textarea" :rows="3" placeholder="请说明撤回申请的原因"
							maxlength="500" show-word-limit />
					</el-form-item>
				</el-form>
			</view>
			<template v-slot:footer>
				<el-button @click="withdrawDialog.show = false">取消</el-button>
				<el-button type="danger" @click="handleWithdrawConfirm" :loading="withdrawLoading">确认撤回</el-button>
			</template>
		</vk-data-dialog>

		<!-- 动态表单弹窗 -->
		<dynamic-form-dialog v-model="dynamicFormDialog.show" :title="dynamicFormDialog.title" :butVisible="false"
			:form-schema="dynamicFormDialog.formSchema" :form-type-code="dynamicFormDialog.formTypeCode"
			:saveLoading="saveFormLoading" :initial-data="dynamicFormDialog.data" @save="handleDynamicFormSave"
			@cancel="handleDynamicFormCancel" @preview-file="previewFile" />

		<!-- 文件预览弹窗公共组件 -->
		<file-preview-dialog v-model="filePreview.show" :file-data="filePreview.data" @download="downloadFile" />
	</view>
</template>

<script>
	// 引入公共组件
	import ApproeWorkFlow from '@/components/approve-work-flow/approve-work-flow.vue';
	import DynamicFormDialog from '@/components/dynamic-form-dialog/dynamic-form-dialog.vue';
	import FilePreviewDialog from '@/components/file-preview-dialog/file-preview-dialog.vue';
	import ApproveHeaderDetail from '@/components/approve-header-detail/approve-header-detail.vue';
	import ReturnHandleDialog from '@/components/return-handle-dialog/return-handle-dialog.vue';
	import ApproveHandleDialog from '@/components/approve-handle-dialog/approve-handle-dialog.vue';

	let vk = uni.vk;

	export default {
		name: 'TaskCenter',
		components: {
			ApproeWorkFlow,
			DynamicFormDialog,
			FilePreviewDialog,
			ApproveHeaderDetail,
			ReturnHandleDialog,
			ApproveHandleDialog
		},
		data() {
			return {
				formDatas: {},
				loading: true,
				//动态表单				
				saveFormLoading: false,
				// 表单类型配置缓存
				formTypeConfigs: {},
				// 流程信息
				processFlow: {
					tasks: [],
					instance: null
				},
				// 动态表单弹窗
				dynamicFormDialog: {
					show: false,
					title: '',
					formSchema: null,
					formTypeCode: '',
					data: null
				},
				// 文件预览相关
				filePreview: {
					show: false,
					data: {
						url: '',
						name: '',
						type: ''
					}
				},
				// 表格配置
				table1: {
					action: "admin/bpmn/task/sys/getList",
					customRightBtns: [{
							mode: 'detail_auto',
							title: '详细',
							icon: 'el-icon-tickets',
							onClick: (item) => {
								this.showDetail(item);
							}
						},
						{
							mode: 'update',
							title: '处理',
							icon: 'el-icon-edit',
							type: 'primary',
							show: (item) => {
								return this.canHandleTask(item) && item.node_type !== 'return';
							},
							onClick: (item) => {
								this.showApproveDialog(item);
							}
						},
						{
							mode: 'update',
							title: '处理退回',
							type: 'warning',
							icon: 'el-icon-refresh-right',
							show: (item) => {
								return item.node_type === 'return' && this.canHandleReturnTask(item);
							},
							onClick: (item) => {
								this.handleReturnTask(item);
							}
						},
						{
							mode: 'update',
							title: '转办',
							type: 'warning',
							icon: 'el-icon-user',
							show: (item) => {
								return this.canTransferTask(item) && item.node_type !== 'return';
							},
							onClick: (item) => {
								this.handleTransfer(item);
							}
						}
					],
					columns: [{
							key: "task_name",
							title: "任务名称",
							type: "text",
							width: 150,
							showOverflowTooltip: true,
							formatter: (value, row) => {
								if (row.node_type === 'return') {
									return `🔄 ${value}`;
								}
								return value;
							}
						},
						{
							key: "application_title",
							title: "申请标题",
							type: "text",
							width: 200,
							showOverflowTooltip: true
						},
						{
							key: "form_type_code",
							title: "申请类型",
							type: "text",
							width: 120,
							formatter: (value) => {
								return this.getFormTypeName(value) || value;
							}
						},
						{
							key: "applicant_name",
							title: "申请人",
							type: "text",
							width: 100
						},
						{
							key: "applicant_department",
							title: "申请部门",
							type: "text",
							width: 120
						},
						{
							key: "_add_time",
							title: "到达时间",
							type: "time",
							width: 180
						},
						{
							key: "due_date",
							title: "截止时间",
							type: "html",
							formatter: (value, row) => {
								if (!value) return '-';
								const now = Date.now();
								const dueTime = new Date(value).getTime();
								const diffHours = Math.ceil((dueTime - now) / (1000 * 60 * 60));

								if (diffHours < 0) {
									return `<text style="color:#F56C6C">已超时 ${Math.abs(diffHours)}小时</text>`;
								} else if (diffHours < 24) {
									return `<text style="color:#E6A23C">剩余 ${diffHours}小时</text>`;
								} else {
									return vk.pubfn.timeFormat(value, 'yyyy-MM-dd hh:mm');
								}
							}
						},
						{
							key: "node_type",
							title: "任务类型",
							type: "text",
							width: 100,
							formatter: (value) => {
								const typeMap = {
									'userTask': '普通任务',
									'approval': '审批任务',
									'return': '退回任务'
								};
								return typeMap[value] || value;
							}
						}
					],
					multipleSelection: [],
					selectItem: ""
				},
				// 查询表单配置
				queryForm1: {
					formData: {
						status: "pending"
					},
					columns: [{
							key: "application_title",
							title: "申请标题",
							type: "text",
							width: 200,
							mode: "%%"
						},
						{
							key: "applicant_name",
							title: "申请人",
							type: "text",
							width: 100,
							mode: "%%"
						},
						{
							key: "form_type_code",
							title: "申请类型",
							type: "select",
							width: 150,
							mode: "=",
							data: []
						},
						{
							key: "_add_time",
							title: "到达时间",
							type: "datetimerange",
							width: 300,
							mode: "[]"
						}
					]
				},
				// 审批弹窗相关
				approveDialog: {
					approvalHistory: [],
					show: false,
					title: "审批处理"
				},
				approveLoading: false,
				currentApplication: null,
				currentTask: null,
				showReturnOption: true,
				showTransferOption: true,
				showAddSignOption: false,
				// 详情弹窗
				detailDialog: {
					show: false,
					title: "申请详情",
					data: null,
					approvalHistory: [],
					currentTasks: [],
					processFlow: {
						tasks: []
					}
				},
				// 批量审批相关
				batchApproveDialog: {
					show: false,
					selectedItems: []
				},
				batchApproveForm: {
					action: "approve",
					comment: ""
				},
				batchApproveRules: {
					action: [{
						required: true,
						message: "请选择审批操作",
						trigger: ['blur', 'change']
					}],
					comment: [{
						required: true,
						message: "请输入审批意见",
						trigger: ['blur', 'change']
					}]
				},
				batchApproveLoading: false,
				// 退回处理相关
				returnDialog: {
					show: false,
					title: "退回处理",
					task: null,
					application: null
				},
				returnLoading: false,
				statusHistory: [],
				// 撤回申请相关
				withdrawDialog: {
					show: false,
					data: null
				},
				withdrawForm: {
					reason: ""
				},
				withdrawRules: {
					reason: [{
						required: true,
						message: "请填写撤回原因",
						trigger: ['blur', 'change']
					}]
				},
				withdrawLoading: false
			};
		},
		onLoad(options = {}) {
			vk = this.vk;
			this.options = options;
			this.init(options);
		},
		methods: {
			// 打开表单
			openForm(name, item) {
				let that = this;
				let {
					vk
				} = that;
				// 确保使用响应式的方式更新
				that
					.$set(that.formDatas, name, item);
			},
			async init(options) {
				try {
					this.loading = true;
					await this.loadFormTypes();
				} catch (error) {
					console.error('初始化失败:', error);
					this.$message.error('页面初始化失败');
				} finally {
					this.loading = false;
				}
			},

			// 文件预览
			previewFile(file) {
				if (!file || !file.url) {
					this.$message.warning('文件地址无效');
					return;
				}

				this.filePreview.data = {
					url: file.url,
					name: file.name,
					type: this.getFileType(file)
				};
				this.filePreview.show = true;
			},

			// 下载文件
			downloadFile(file) {
				if (!file || !file.url) {
					this.$message.warning('文件地址无效');
					return;
				}

				// 创建下载链接
				const link = document.createElement('a');
				link.href = file.url;
				link.download = file.name || 'download';
				link.style.display = 'none';

				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);

				this.$message.success('开始下载文件');
			},

			// 获取文件类型
			getFileType(file) {
				if (!file) return 'unknown';

				const name = file.name || '';
				const type = file.type || '';

				if (type.includes('pdf') || name.toLowerCase().endsWith('.pdf')) {
					return 'pdf';
				} else if (type.includes('image') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name)) {
					return 'image';
				} else if (type.includes('text') || /\.(txt|md)$/i.test(name)) {
					return 'text';
				} else {
					return 'other';
				}
			},

			async loadFormTypes() {
				try {
					const res = await this.vk.callFunction({
						url: 'admin/bpmn/form-type/sys/getList',
						data: {
							pageSize: 100
						}
					});

					if (res.code === 0 && res.rows) {
						// 缓存表单类型配置
						res.rows.forEach(formType => {
							this.formTypeConfigs[formType.code] = formType;
						});

						// 更新查询条件中的申请类型选项
						const formTypeColumn = this.queryForm1.columns.find(c => c.key === 'form_type_code');
						if (formTypeColumn) {
							formTypeColumn.data = res.rows.map(item => ({
								value: item.code,
								label: item.name
							}));
						}
					}
				} catch (error) {
					console.error('加载表单类型失败:', error);
				}
			},

			getFormTypeSchema(formTypeCode) {
				const formType = this.formTypeConfigs[formTypeCode];
				if (formType && formType.form_schema) {
					return JSON.parse(formType.form_schema);
				}
				return null;
			},

			getFormTypeName(formTypeCode) {
				const formType = this.formTypeConfigs[formTypeCode];
				return formType ? formType.name : formTypeCode;
			},

			getStatusType(status) {
				const typeMap = {
					draft: 'info',
					pending: 'warning',
					approved: 'success',
					rejected: 'danger',
					cancelled: 'info',
					withdrawn: 'info',
					returned: 'warning'
				};
				return typeMap[status] || 'info';
			},

			getStatusText(status) {
				const textMap = {
					draft: '草稿',
					pending: '审批中',
					approved: '已通过',
					rejected: '已驳回',
					cancelled: '已取消',
					withdrawn: '已撤回',
					returned: '已退回'
				};
				return textMap[status] || status;
			},

			formatDate(timestamp) {
				if (!timestamp) return '-';
				return vk.pubfn.timeFormat(timestamp, 'yyyy-MM-dd hh:mm:ss');
			},

			search() {
				this.$refs.table1.search();
			},

			refresh() {
				this.$refs.table1.refresh();
			},

			currentChange(val) {
				this.table1.selectItem = val;
			},

			selectionChange(list) {
				this.table1.multipleSelection = list;
			},

			// 判断是否可以处理任务
			canHandleTask(task) {
				const userInfo = vk.getVuex('$user.userInfo');
				return task.assignee === userInfo.username ||
					(task.candidate_users && task.candidate_users.includes(userInfo.username)) ||
					(task.candidate_groups && task.candidate_groups.some(group =>
						userInfo.role && userInfo.role.includes(group)));
			},

			// 判断是否可以处理退回任务
			canHandleReturnTask(task) {
				const userInfo = vk.getVuex('$user.userInfo');
				if (task.node_type !== 'return') return false;
				return task.assignee === userInfo.username;
			},

			// 判断是否可以转办任务
			canTransferTask(task) {
				const userInfo = vk.getVuex('$user.userInfo');
				return task.assignee === userInfo.username;
			},

			async showDetail(item) {
				try {
					// 获取申请详情
					const appRes = await this.vk.callFunction({
						url: 'admin/bpmn/application-form/pub/detail',
						data: {
							userInfo: vk.getVuex('$user.userInfo'),
							_id: item.application_id
						}
					});

					if (appRes.code === 0) {
						this.detailDialog.data = appRes.data.application;
						this.detailDialog.approvalHistory = appRes.data.history || [];
						this.detailDialog.title =
							`${this.getFormTypeName(appRes.data.application.form_type_code)} - 申请详情`;

						// 获取当前任务
						const taskRes = await this.vk.callFunction({
							url: 'admin/bpmn/task/sys/getList',
							data: {
								formData: {
									application_id: item.application_id,
									status: 'pending'
								}
							}
						});

						this.detailDialog.currentTasks = taskRes.code === 0 ? taskRes.rows : [];

						// 获取完整的审批流程任务
						await this.loadProcessFlow(item.application_id, 'detail');
					} else {
						this.detailDialog.data = item;
						this.detailDialog.approvalHistory = [];
						this.detailDialog.currentTasks = [];
						this.detailDialog.title = '申请详情';
					}
				} catch (error) {
					console.error('加载详情失败:', error);
					this.detailDialog.data = item;
					this.detailDialog.approvalHistory = [];
					this.detailDialog.currentTasks = [];
					this.detailDialog.title = '申请详情';
				}

				this.detailDialog.show = true;
			},

			// 加载审批流程
			async loadProcessFlow(applicationId, type = 'approve') {
				try {
					const taskRes = await this.vk.callFunction({
						url: 'admin/bpmn/task/sys/getList',
						data: {
							formData: {
								application_id: applicationId
							},
							orderBy: 'sequence asc'
						}
					});

					if (taskRes.code === 0) {
						if (type === 'approve') {
							this.processFlow.tasks = taskRes.rows || [];
						} else {
							this.detailDialog.processFlow.tasks = taskRes.rows || [];
						}
					}
				} catch (error) {
					console.error('加载审批流程失败:', error);
				}
			},

			async showApproveDialog(item) {
				this.currentTask = item;
				try {
					// 获取申请详情
					const res = await this.vk.callFunction({
						url: 'admin/bpmn/application-form/pub/detail',
						data: {
							userInfo: vk.getVuex('$user.userInfo'),
							_id: item.application_id
						}
					});

					if (res.code === 0) {
						this.currentApplication = res.data.application;
						this.approveDialog.title =
							`${this.getFormTypeName(this.currentApplication.form_type_code)} - 审批处理`;
						this.approveDialog.approvalHistory = res.data.history;

						// 根据任务类型显示不同的操作选项
						this.showReturnOption = item.task_key !== 'start';
						this.showTransferOption = true;
						this.showAddSignOption = item.allow_add_sign === true;

						// 加载审批流程
						await this.loadProcessFlow(item.application_id);

						this.approveDialog.show = true;
					} else {
						this.$message.error('获取申请详情失败');
					}
				} catch (error) {
					console.error('获取申请详情失败:', error);
					this.$message.error('获取申请详情失败');
				}
			},

			onActionChange(action) {
				if (action === 'approve') {
					this.showAddSignOption = this.currentTask && this.currentTask.allow_add_sign === true;
				} else {
					this.showAddSignOption = false;
				}
			},

			async handleApproveSubmit(submitData) {
				try {
					this.approveLoading = true;

					const completeData = {
						...submitData,
						userInfo: vk.getVuex('$user.userInfo')
					};

					console.log("completeData:", completeData);

					const res = await this.vk.callFunction({
						url: 'admin/bpmn/task/pub/complete',
						data: completeData
					});

					if (res.code === 0) {
						this.$message.success('处理成功');
						this.approveDialog.show = false;
						this.refresh();
					} else {
						this.$message.error(res.msg || '处理失败');
					}
				} catch (error) {
					console.error('处理失败:', error);
					if (error.message) {
						this.$message.error(error.message);
					} else {
						this.$message.error('处理失败');
					}
				} finally {
					this.approveLoading = false;
				}
			},

			async handleTransfer(task) {
				try {
					// 权限验证 - 只有当前处理人可以转交任务
					const userInfo = vk.getVuex('$user.userInfo');
					if (task.assignee !== userInfo.username) {
						this.$message.error('只有当前任务处理人可以转交任务');
						return;
					}

					await this.showApproveDialog(task);
				} catch (error) {
					console.error('转交任务失败:', error);
					this.$message.error('转交任务失败: ' + (error.message || '未知错误'));
				}
			},

			canHandleCurrentTask(application) {
				const userInfo = vk.getVuex('$user.userInfo');
				const currentTask = this.detailDialog.currentTasks[0];
				if (!application || !this.detailDialog.currentTasks || this.detailDialog.currentTasks.length === 0 ||
					currentTask.node_type == 'return') return false;

				console.log("currentTask:", currentTask);
				return currentTask.assignee === userInfo.username ||
					(currentTask.candidate_users && currentTask.candidate_users.includes(userInfo.username));
			},

			handleTaskFromDetail(application) {
				if (this.detailDialog.currentTasks && this.detailDialog.currentTasks.length > 0) {
					const task = this.detailDialog.currentTasks[0];
					this.showApproveDialog(task);
					this.detailDialog.show = false;
				}
			},

			// 批量审批相关方法
			showBatchApproveDialog() {
				const selectedItems = this.table1.multipleSelection;
				if (selectedItems.length === 0) {
					this.$message.warning('请选择要处理的待办任务');
					return;
				}

				this.batchApproveDialog.selectedItems = selectedItems;
				this.batchApproveForm = {
					action: "approve",
					comment: ""
				};
				this.batchApproveDialog.show = true;
			},

			async handleBatchApprove() {
				try {
					await this.$refs.batchApproveFormRef.validate();
					this.batchApproveLoading = true;

					const res = await this.vk.callFunction({
						url: 'admin/bpmn/task/sys/batchComplete',
						data: {
							task_ids: this.batchApproveDialog.selectedItems.map(item => item._id),
							action: this.batchApproveForm.action,
							comment: this.batchApproveForm.comment
						}
					});

					if (res.code === 0) {
						this.$message.success(`批量处理成功，共处理 ${res.data.processed_count} 个任务`);
						this.batchApproveDialog.show = false;
						this.table1.multipleSelection = [];
						this.refresh();
					} else {
						this.$message.error(res.msg || '批量处理失败');
					}
				} catch (error) {
					console.error('批量处理失败:', error);
					this.$message.error('批量处理失败');
				} finally {
					this.batchApproveLoading = false;
				}
			},

			// 退回任务处理相关方法
			async handleReturnTask(task) {
				try {
					if (task.node_type !== 'return') {
						this.$message.error('该任务不是退回任务');
						return;
					}

					// 权限验证 - 只有申请人可以处理退回任务
					const userInfo = vk.getVuex('$user.userInfo');
					if (task.assignee !== userInfo.username) {
						this.$message.error('只有申请人可以处理退回任务');
						return;
					}

					this.returnDialog.task = task;

					// 获取申请详情用于显示
					const appRes = await this.vk.callFunction({
						url: 'admin/bpmn/application-form/pub/detail',
						data: {
							userInfo: userInfo,
							_id: task.application_id
						}
					});

					if (appRes.code === 0) {
						this.returnDialog.application = appRes.data.application;
					} else {
						this.returnDialog.application = null;
					}

					this.returnDialog.title = `退回处理 - ${this.getFormTypeName(task.form_type_code)}`;
					this.returnDialog.show = true;
				} catch (error) {
					console.error('处理退回任务失败:', error);
					this.$message.error('处理退回任务失败: ' + (error.message || '未知错误'));
				}
			},

			// 修改申请信息
			editApplicationContent() {
				if (!this.returnDialog.application) {
					this.$message.error('申请信息不存在');
					return;
				}

				const application = this.returnDialog.application;
				const formTypeCode = application.form_type_code;
				const formSchema = this.getFormTypeSchema(formTypeCode);

				if (!formSchema) {
					this.$message.error('表单配置不存在');
					return;
				}

				// 重新组织数据格式，确保字段在顶层
				const formData = {
					...application
				};

				// 将 form_data 中的字段提升到顶层
				if (application.form_data) {
					Object.keys(application.form_data).forEach(key => {
						formData[key] = application.form_data[key];
					});
				}

				console.log('重组后的数据:', formData);
				this.dynamicFormDialog = {
					show: true,
					title: `修改申请信息 - ${this.getFormTypeName(formTypeCode)}`,
					formSchema: formSchema,
					formTypeCode: formTypeCode,
					data: formData
				};

				this.openForm("dynamicFormDialog", this.dynamicFormDialog);

			},

			// 动态表单保存处理
			async handleDynamicFormSave(formData) {
				try {
					this.saveFormLoading = true;
					let url = "admin/bpmn/application-form/sys/update";
					const res = await this.vk.callFunction({
						url,
						data: formData
					});

					if (res.code === 0) {
						if (this.returnDialog.application) {
							this.returnDialog.application = {
								...this.returnDialog.application,
								...formData
							};
						}
						this.$message.success('申请信息修改成功');
						this.dynamicFormDialog.show = false;
					} else {
						this.$message.error(res.msg || '保存申请信息失败');
					}
				} catch (error) {
					console.error('保存申请信息失败:', error);
					this.$message.error('保存申请信息失败');
				} finally {
					this.saveFormLoading = false;
				}
			},

			// 动态表单取消处理
			handleDynamicFormCancel() {
				this.dynamicFormDialog.show = false;
			},

			// 提交退回处理
			async handleReturnSubmit(submitData) {
				try {
					this.returnLoading = true;

					const res = await this.vk.callFunction({
						url: 'admin/bpmn/task/pub/handleReturn',
						data: {
							...submitData,
							userInfo: vk.getVuex('$user.userInfo')
						}
					});

					if (res.code === 0) {
						this.$message.success('处理成功');
						this.returnDialog.show = false;
						this.refresh();

						if (submitData.action === 'resubmit') {
							this.$message.success('申请已重新提交，等待审批');
						} else if (submitData.action === 'withdraw') {
							this.$message.success('申请已撤回');
						}
					} else {
						this.$message.error(res.msg || '处理失败');
					}
				} catch (error) {
					console.error('处理失败:', error);
					this.$message.error('处理失败');
				} finally {
					this.returnLoading = false;
				}
			},

			// 检查是否有退回任务
			hasReturnTask(application) {
				if (!application || !this.detailDialog.currentTasks) return false;
				return this.detailDialog.currentTasks.some(task => task.node_type === 'return');
			},

			// 从详情页面处理退回任务
			handleReturnTaskFromDetail(application) {
				const returnTask = this.detailDialog.currentTasks.find(task => task.node_type === 'return');
				if (returnTask) {
					this.handleReturnTask(returnTask);
					this.detailDialog.show = false;
				}
			},

			// 检查是否可以撤回申请
			canWithdrawApplication(application) {
				if (!application) return false;
				const userInfo = vk.getVuex('$user.userInfo');
				return application.applicant_id === userInfo.username &&
					(application.status === 'pending' || application.status === 'returned');
			},

			// 撤回申请
			handleWithdrawApplication(application) {
				this.withdrawDialog.data = application;
				this.withdrawForm.reason = "";
				this.withdrawDialog.show = true;
			},

			async handleWithdrawConfirm() {
				try {
					await this.$refs.withdrawFormRef.validate();
					this.withdrawLoading = true;

					const res = await this.vk.callFunction({
						url: 'admin/bpmn/task/pub/handleReturn',
						data: {
							application_id: this.withdrawDialog.data._id,
							reason: this.withdrawForm.reason,
							userInfo: vk.getVuex('$user.userInfo')
						}
					});

					if (res.code === 0) {
						this.$message.success('申请已撤回');
						this.withdrawDialog.show = false;
						this.detailDialog.show = false;
						this.refresh();
					} else {
						this.$message.error(res.msg || '撤回失败');
					}
				} catch (error) {
					console.error('撤回失败:', error);
					this.$message.error('撤回失败');
				} finally {
					this.withdrawLoading = false;
				}
			}
		}
	};
</script>

<style lang="scss" scoped>
	.page-body {
		padding: 20rpx;
	}

	.button-group {
		margin-bottom: 20rpx;
		padding: 20rpx;
		background: #fff;
		border-radius: 8rpx;
		box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.1);
	}

	.batch-approve-content {
		.batch-info {
			margin-bottom: 16px;
		}
	}

	.withdraw-dialog-content {
		.el-alert {
			margin-bottom: 20px;
		}
	}
</style>