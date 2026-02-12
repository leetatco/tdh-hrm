<template>
	<vk-data-dialog v-model="show" :title="title" width="900px">
		<!-- 使用 ApproveHeaderDetail 组件 -->
		<approve-header-detail :detail-data="application" :form-schema="formSchema" :process-info="processInfo"
			:status-history="approvalHistory" :show-basic-info="true" :show-return-info="false"
			:show-approval-flow="true" :show-current-task="false" :show-handle-form="false" :basic-info-title="'基本信息'"
			:form-info-title="'申请信息'" :form-type-configs="formTypeConfigs" @preview-file="handlePreviewFile"
			@download-file="handleDownloadFile" />

		<!-- 当前任务信息 -->
		<view class="detail-section" v-if="task">
			<view class="section-title">当前任务</view>
			<view class="info-grid">
				<view class="info-item">
					<view class="info-label">任务名称：</view>
					<view class="info-value">
						<el-tag type="warning">{{ task.task_name }}</el-tag>
					</view>
				</view>
				<view class="info-item">
					<view class="info-label">到达时间：</view>
					<view class="info-value">{{ formatDate(task._add_time) }}</view>
				</view>
				<view class="info-item">
					<view class="info-label">截止时间：</view>
					<view class="info-value">
						<span :class="{'text-danger': isTaskOverdue(task)}">
							{{ formatDate(task.due_date) }}
						</span>
					</view>
				</view>
				<view class="info-item">
					<view class="info-label">处理人：</view>
					<view class="info-value">
						{{ task.assignee_name || task.assignee }}
					</view>
				</view>
			</view>
		</view>

		<!-- 审批操作表单 -->
		<view class="detail-section">
			<view class="section-title">审批操作</view>
			<el-form :model="approveForm" :rules="approveRules" ref="approveFormRef" label-width="100px">
				<el-form-item label="操作类型" prop="action" required>
					<el-radio-group v-model="approveForm.action" @change="onActionChange">
						<el-radio label="approve">同意</el-radio>
						<el-radio label="reject">驳回</el-radio>
						<el-radio label="return" v-if="showReturnOption">退回</el-radio>
						<el-radio label="transfer" v-if="showTransferOption">转办</el-radio>
					</el-radio-group>
				</el-form-item>

				<el-form-item label="审批意见" prop="comment" :required="approveForm.action !== 'approve'">
					<el-input v-model="approveForm.comment" type="textarea" :rows="4"
						:placeholder="getCommentPlaceholder()" maxlength="500" show-word-limit />
				</el-form-item>

				<el-form-item label="转办人员" v-if="approveForm.action === 'transfer'" prop="transfer_user" required>
					<vk-data-input-table-select v-model="approveForm.transfer_user"
						action="admin/hrm/employees/sys/getList" placeholder="请选择转办人员" :columns="[
              { key:'employee_name', title:'姓名', type:'text', nameKey:true },
              { key:'employee_id', title:'工号', type:'text', idKey:true }
            ]" />
				</el-form-item>

				<el-form-item label="加签人员" v-if="showAddSignOption">
					<user-selector v-model="approveForm.add_sign_users" multiple placeholder="请选择加签人员" />
					<div class="form-tip">加签人员将在此环节前进行审批</div>
				</el-form-item>
			</el-form>
		</view>

		<template v-slot:footer>
			<el-button @click="handleClose">取消</el-button>
			<el-button type="primary" @click="handleSubmit" :loading="loading">确定</el-button>
		</template>
	</vk-data-dialog>
</template>

<script>
	import ApproveHeaderDetail from '@/components/approve-header-detail/approve-header-detail.vue';

	export default {
		name: 'ApproveHandleDialog',
		components: {
			ApproveHeaderDetail
		},
		props: {
			value: {
				type: Boolean,
				default: false
			},
			title: {
				type: String,
				default: '审批处理'
			},
			// 数据相关
			task: {
				type: Object,
				default: null
			},
			application: {
				type: Object,
				default: null
			},
			formSchema: {
				type: Object,
				default: null
			},
			processInfo: {
				type: Object,
				default: () => ({
					tasks: [],
					instance: null
				})
			},
			approvalHistory: {
				type: Array,
				default: () => []
			},
			formTypeConfigs: {
				type: Object,
				default: () => ({})
			},
			// 操作选项控制
			showReturnOption: {
				type: Boolean,
				default: true
			},
			showTransferOption: {
				type: Boolean,
				default: true
			},
			showAddSignOption: {
				type: Boolean,
				default: false
			},
			// 加载状态
			loading: {
				type: Boolean,
				default: false
			}
		},
		data() {
			return {
				approveForm: {
					action: 'approve',
					comment: '',
					transfer_user: '',
					add_sign_users: []
				},
				approveRules: {
					action: [{
						required: true,
						message: "请选择审批操作",
						trigger: ['blur', 'change']
					}],
					comment: [{
						validator: (rule, value, callback) => {
							if (this.approveForm.action !== 'approve' && !value) {
								callback(new Error("驳回或退回时必须填写审批意见"));
							} else {
								callback();
							}
						},
						trigger: ['blur', 'change']
					}],
					transfer_user: [{
						validator: (rule, value, callback) => {
							if (this.approveForm.action === 'transfer' && !value) {
								callback(new Error("请选择转办人员"));
							} else {
								callback();
							}
						},
						trigger: ['blur', 'change']
					}]
				}
			};
		},
		computed: {
			show: {
				get() {
					return this.value;
				},
				set(val) {
					this.$emit('input', val);
				}
			}
		},
		watch: {
			value(newVal) {
				if (newVal) {
					this.resetForm();
				}
			},
			task(newTask) {
				if (newTask) {
					this.updateOptionsByTask(newTask);
				}
			}
		},
		methods: {
			handleClose() {
				this.show = false;
			},

			handlePreviewFile(file) {
				this.$emit('preview-file', file);
			},

			handleDownloadFile(file) {
				this.$emit('download-file', file);
			},

			onActionChange(action) {
				if (action === 'approve') {
					this.$emit('update:showAddSignOption', this.task && this.task.allow_add_sign === true);
				} else {
					this.$emit('update:showAddSignOption', false);
				}
				this.$emit('action-change', action);
			},

			async handleSubmit() {
				try {
					await this.$refs.approveFormRef.validate();

					const submitData = {
						task_id: this.task._id,
						action: this.approveForm.action,
						comment: this.approveForm.comment,
						transfer_user: this.approveForm.transfer_user,
						add_sign_users: this.approveForm.add_sign_users,
						applicationDate: this.application
					};

					this.$emit('submit', submitData);
				} catch (error) {
					console.error('表单验证失败:', error);
				}
			},

			resetForm() {
				this.approveForm = {
					action: 'approve',
					comment: '',
					transfer_user: '',
					add_sign_users: []
				};

				if (this.$refs.approveFormRef) {
					this.$refs.approveFormRef.clearValidate();
				}
			},

			updateOptionsByTask(task) {
				if (task) {
					this.$emit('update:showReturnOption', task.task_key !== 'start');
					this.$emit('update:showTransferOption', true);
					this.$emit('update:showAddSignOption', task.allow_add_sign === true);
				}
			},

			getCommentPlaceholder() {
				switch (this.approveForm.action) {
					case 'approve':
						return '同意时可选填审批意见';
					case 'reject':
						return '请填写驳回理由';
					case 'return':
						return '请填写退回原因';
					case 'transfer':
						return '请填写转办说明';
					default:
						return '请输入审批意见';
				}
			},

			isTaskOverdue(task) {
				if (!task || !task.due_date) return false;
				const now = Date.now();
				const dueTime = new Date(task.due_date).getTime();
				return dueTime < now;
			},

			formatDate(timestamp) {
				if (!timestamp) return '-';
				const vk = uni.vk;
				return vk.pubfn.timeFormat(timestamp, 'yyyy-MM-dd hh:mm:ss');
			}
		}
	};
</script>

<style lang="scss" scoped>
	.detail-section {
		margin-bottom: 24px;

		.section-title {
			font-size: 16px;
			font-weight: bold;
			color: #303133;
			margin-bottom: 16px;
			padding-bottom: 8px;
			border-bottom: 1px solid #e4e7ed;
		}

		.info-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 16px;

			.info-item {
				display: flex;
				align-items: flex-start;

				.info-label {
					font-weight: bold;
					color: #606266;
					min-width: 100px;
				}

				.info-value {
					color: #303133;
					flex: 1;

					.text-danger {
						color: #f56c6c;
						font-weight: bold;
					}
				}
			}
		}

		// 表单样式
		.el-form {
			.el-form-item {
				margin-bottom: 18px;

				:deep(.el-form-item__label) {
					font-weight: bold;
					color: #606266;
				}

				:deep(.el-radio-group) {
					.el-radio {
						margin-right: 20px;
					}
				}

				:deep(.el-textarea) {
					.el-textarea__inner {
						border-radius: 4px;
						resize: vertical;
					}
				}
			}
		}
	}

	.form-tip {
		color: #909399;
		font-size: 12px;
		margin-top: 4px;
	}

	// 响应式调整
	@media (max-width: 768px) {
		.detail-section .info-grid {
			grid-template-columns: 1fr;
			gap: 12px;
		}
	}
</style>