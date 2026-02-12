<template>
	<vk-data-dialog v-model="form.props.show" :title="form.props.title" width="930px" mode="form"
		:destroy-on-close="true" @closed="handleCancel">
		<vk-data-form v-model="form.data" :rules="form.props.rules" :action="form.props.action" ref="formRef"
			:form-type="form.props.formType" :columns="form.props.columns" label-width="130px" :inline="true"
			:columnsNumber="2" :border="true" @success="handleSuccess">
			<template v-slot:file_attachments>
				<!-- 文件上传 -->
				<div v-if="getFieldType('file_attachments') === 'file'" class="file-upload-container">
					<vk-data-upload ref="fileUploadRef" :accept="getFieldAccept('file_attachments')"
						:file-list="form.data.form_data['file_attachments'] || []" :action="uploadConfig.action"
						:headers="uploadConfig.headers" :multiple="getFileMultiple('file_attachments')"
						:limit="getFileMaxCount('file_attachments')" :on-exceed="handleExceed"
						:before-upload="beforeUpload"
						:on-success="(res, file, fileList) => onUploadSuccess(res, file, fileList, 'file_attachments')"
						:on-remove="(file, fileList) => onUploadRemove(file, fileList, 'file_attachments')"
						:on-error="onUploadError" :on-preview="onUploadPreview" list-type="text">
						<el-button size="small" type="primary" icon="el-icon-upload" class="upload-button">
							点击上传
						</el-button>
						<div slot="tip" class="el-upload__tip">
							{{ getFileDescription('file_attachments') }}
						</div>
					</vk-data-upload>
					<!-- 文件列表展示 -->
					<div v-if="form.data.form_data['file_attachments'] && form.data.form_data['file_attachments'].length > 0"
						class="file-list">
						<div v-for="(file, index) in form.data.form_data['file_attachments']" :key="index"
							class="file-item">
							<div class="file-info">
								<i class="el-icon-document file-icon"></i>
								<span class="file-name" :title="file.name || file.url">
									{{ file.name || file.url }}
								</span>
								<span class="file-size" v-if="file.size">
									({{ formatFileSize(file.size) }})
								</span>
							</div>
							<div class="file-actions">
								<el-button type="text" size="mini" @click="previewFile(file)">预览</el-button>
								<el-button type="text" size="mini" @click="downloadFile(file)">下载</el-button>
								<el-button type="text" size="mini" class="delete-btn"
									@click="removeFile('file_attachments', index)">
									删除
								</el-button>
							</div>
						</div>
					</div>
				</div>
			</template>
			<!-- 自定义按钮区域 -->
			<template v-slot:footer>
				<el-button @click="handleCancel">取消</el-button>
				<el-button v-if="!butVisible" type="primary" :loading="saveLoadingLocal"
					@click="handleSave()">保存</el-button>
				<el-button v-if="butVisible" type="info" @click="handleSimulate"
					:loading="simulateLoadingLocal">试算流程</el-button>
				<el-button v-if="butVisible" type="primary" @click="handleSave('draft')"
					:loading="saveLoadingLocal">保存草稿</el-button>
				<el-button v-if="butVisible" type="success" @click="handleSubmit"
					:loading="submitLoadingLocal">提交申请</el-button>
			</template>
		</vk-data-form>
	</vk-data-dialog>
</template>

<script>
	let vk = uni.vk;
	export default {
		name: 'DynamicFormDialog',
		props: {
			// 控制显示隐藏
			value: {
				type: Boolean,
				default: false
			},
			// 控制button显示隐藏
			butVisible: {
				type: Boolean,
				default: false
			},
			// 弹窗标题
			title: {
				type: String,
				default: '表单'
			},
			// 表单配置
			formSchema: {
				type: Object,
				default: null
			},
			// 表单类型代码
			formTypeCode: {
				type: String,
				required: true
			},
			// 初始表单数据
			initialData: {
				type: Object,
				default: () => ({})
			},
			// 表单动作 (add/update)
			formAction: {
				type: String,
				default: 'add'
			},
			// 表单提交地址
			actionUrl: {
				type: String,
				default: ''
			},
			// 新增 loading 状态 props
			saveLoading: {
				type: Boolean,
				default: false
			},
			submitLoading: {
				type: Boolean,
				default: false
			},
			simulateLoading: {
				type: Boolean,
				default: false
			}
		},
		data() {
			return {
				watchHandlers: {
					watchEmployeeChange: this.watchEmployeeChange,
					watchNewPositionChange: this.watchNewPositionChange,
					handleCascaderChange: this.handleCascaderChange,
					validateCascaderSelection: this.validateCascaderSelection
				},
				// 表单配置 - 遵循 form1 的数据结构
				form: {
					// 表单请求数据
					data: {
						form_type_code: this.formTypeCode,
						form_data: {}
					},
					// 表单属性
					props: {
						// 表单请求地址
						action: this.actionUrl,
						// 表单字段显示规则
						columns: [],
						// 表单验证规则
						rules: {},
						// add 代表添加 update 代表修改
						formType: this.formAction,
						// 弹窗标题
						title: this.title,
						// 是否显示表单的弹窗
						show: false
					}
				},
				// 文件上传配置
				uploadConfig: {
					action: 'admin/upload/file',
					headers: {},
					withCredentials: false
				},
				// 本地loading状态，避免直接修改props
				saveLoadingLocal: false,
				submitLoadingLocal: false,
				simulateLoadingLocal: false
			};
		},
		computed: {
			visible: {
				get() {
					return this.value;
				},
				set(val) {
					this.$emit('input', val);
				}
			}
		},
		watch: {
			visible: {
				immediate: true,
				handler(newVal) {
					this.form.props.show = newVal;
					if (newVal) {
						this.$nextTick(() => {
							this.initForm();
						});
					}
				}
			},
			formSchema: {
				immediate: true,
				deep: true,
				handler(newVal) {
					if (newVal && this.visible) {
						this.$nextTick(() => {
							this.initForm();
						});
					}
				}
			},
			initialData: {
				immediate: true,
				deep: true,
				handler(newVal) {
					if (newVal && Object.keys(newVal).length > 0) {
						this.handleInitialData(newVal);
					}
				}
			},
			title(newVal) {
				this.form.props.title = newVal;
			},
			formAction(newVal) {
				this.form.props.formType = newVal;
			},
			actionUrl(newVal) {
				this.form.props.action = newVal;
			},
			// 监听props的loading状态，同步到本地状态
			saveLoading(newVal) {
				this.saveLoadingLocal = newVal;
			},
			submitLoading(newVal) {
				this.submitLoadingLocal = newVal;
			},
			simulateLoading(newVal) {
				this.simulateLoadingLocal = newVal;
			}
		},
		methods: {
			// 人员选择变化监听 - 自动填充现公司、部门、职务
			watchEmployeeChange({
				value,
				formData,
				column,
				index,
				option
			}) {
				console
					.log('人员选择变化:', value, formData, column, index, option);

				if (option) {
					// 填充员工姓名
					formData
						.employee_name = option.employee_name || '';

					// 填充现公司信息
					const companyInfo = option.companys;
					if (companyInfo) {
						formData
							.current_company_id = companyInfo.company_id || '';
						formData
							.current_company_name = companyInfo.company_name || '';
					}

					// 填充现部门信息
					const departmentInfo = option.departments;
					if (departmentInfo) {
						formData
							.current_department_id = departmentInfo.department_id || '';
						formData
							.current_department_name = departmentInfo.department_name || '';
					}

					// 填充现职务信息
					const positionInfo = option.positions;
					if (positionInfo) {
						formData
							.current_position_id = positionInfo.position_id || '';
						formData
							.current_position_name = positionInfo.position_name || '';
					}
				} else {
					// 如果选项信息不完整，清空相关字段
					formData
						.employee_name = '';
					formData
						.current_company_id = '';
					formData
						.current_company_name = '';
					formData
						.current_department_id = '';
					formData
						.current_department_name = '';
					formData
						.current_position_id = '';
					formData
						.current_position_name = '';
				}

				// 强制更新视图
				this.$forceUpdate();
			},

			// 级联选择器变化处理
			handleCascaderChange({
				value,
				formData,
				column,
				index,
				option
			}) {
				console.log('级联选择变化:', value, option);
				if (value && value.length >= 2) {
					// 获取选中的路径节点
					const companyNode = option.companys;
					const departmentNode = option;

					// 设置新公司信息
					formData
						.new_company_id = companyNode.company_id || companyNode.value;
					formData
						.new_company_name = companyNode.company_name || companyNode.label;

					// 设置新部门信息
					formData
						.new_department_id = departmentNode.department_id || departmentNode.value;
					formData
						.new_department_name = departmentNode.department_name || departmentNode.label;

					console
						.log('设置新公司部门信息:', {
							companyId: formData.new_company_id,
							companyName: formData.new_company_name,
							departmentId: formData.new_department_id,
							departmentName: formData.
							new_department_name
						});
				} else {
					// 如果没有选择完整，清空
					formData
						.new_company_id = '';
					formData
						.new_company_name = '';
					formData
						.new_department_id = '';
					formData
						.new_department_name = '';
				}

				this.$forceUpdate();
			},

			// 新职务选择变化处理
			watchNewPositionChange({
				value,
				formData,
				column,
				index,
				option
			}) {
				console
					.log('新职务选择变化:', value, option);

				if (option) {
					formData
						.new_position_id = value;
					formData
						.new_position_name = option.position_name || option.label || '';
				} else {
					formData
						.new_position_id = '';
					formData
						.new_position_name = '';
				}

				this.$forceUpdate();
			},

			// 级联选择器验证
			validateCascaderSelection(rule, value = [], callback) {
				if (!value || value.length < 2) {
					callback(new Error('请选择具体部门'));
				} else {
					callback();
				}
			},

			// 处理初始数据
			handleInitialData(initialData) {
				console.log('处理初始数据:', initialData);

				// 重置表单数据
				this.form.data = {
					form_type_code: this.formTypeCode,
					form_data: {}
				};

				// 合并初始数据
				if (initialData) {
					// 合并顶层字段
					const {
						form_data,
						...otherData
					} = initialData;
					this.form.data = {
						...this.form.data,
						...otherData
					};

					// 合并 form_data 字段
					if (form_data) {
						this.form.data.form_data = {
							...this.form.data.form_data,
							...form_data
						};
					}

					// 处理表格数据
					if (this.form.data.form_data.employee_list &&
						!Array.isArray(this.form.data.form_data.employee_list)) {
						this.form.data.form_data.employee_list = [];
					}

					// 确保文件数据格式正确
					if (this.form.data.form_data.supporting_documents &&
						!Array.isArray(this.form.data.form_data.supporting_documents)) {
						this.form.data.form_data.supporting_documents = [];
					}
				}

				console.log('处理后的表单数据:', this.form.data);
			},

			// 初始化表单
			initForm() {
				if (!this.formSchema || !this.formSchema.fields) {
					console.warn('表单配置为空');
					return;
				}

				console.log('开始初始化表单，fields:', this.formSchema.fields);

				// 初始化表单数据
				this.initFormData();

				// 初始化表单字段配置
				this.form.props.columns = this.convertFieldsToColumns();

				// 初始化验证规则
				this.initFormRules();

				console.log('初始化后的form:', this.form);
				console.log('验证规则:', this.form.props.rules);
			},

			// 初始化表单数据
			initFormData() {
				if (!this.formSchema || !this.formSchema.fields) return;

				const formData = {};
				this.formSchema.fields.forEach(field => {
					if (field.type === 'file') {
						formData[field.name] = [];
					} else if (field.type === 'table') {
						formData[field.name] = field.defaultValue || [];
					} else {
						formData[field.name] = field.defaultValue || '';
					}
				});

				// 如果已经有初始数据，则合并到 form_data 中
				if (this.initialData && this.initialData.form_data) {
					Object.assign(formData, this.initialData.form_data);
				}

				this.form.data.form_data = {
					...formData,
					...this.form.data.form_data
				};
			},

			// 初始化表单验证规则
			initFormRules() {
				if (!this.formSchema || !this.formSchema.fields) return;
				const rules = {};

				this.formSchema.fields.forEach(field => {
					const fieldKey = field.name; // 直接使用字段名，不使用 form_data. 前缀
					const fieldRules = [];

					// 必填验证
					if (field.required) {
						if (field.type === 'file' || field.type === 'table') {
							fieldRules.push({
								validator: (rule, value, callback) => {
									if (!value || (Array.isArray(value) && value.length === 0)) {
										callback(new Error(`${field.label}是必填项`));
									} else {
										callback();
									}
								},
								trigger: ['change', 'blur']
							});
						} else {
							fieldRules.push({
								required: true,
								message: `${field.label}是必填项`,
								trigger: ['blur', 'change']
							});
						}
					}

					// 数字类型验证
					if (field.type === 'number') {
						if (field.min !== undefined) {
							fieldRules.push({
								type: 'number',
								min: field.min,
								message: `${field.label}不能小于${field.min}`,
								trigger: ['blur', 'change']
							});
						}
						if (field.max !== undefined) {
							fieldRules.push({
								type: 'number',
								max: field.max,
								message: `${field.label}不能大于${field.max}`,
								trigger: ['blur', 'change']
							});
						}
					}

					// 文本长度验证
					if (field.type === 'text' || field.type === 'textarea') {
						if (field.maxLength) {
							fieldRules.push({
								max: field.maxLength,
								message: `${field.label}不能超过${field.maxLength}个字符`,
								trigger: ['blur', 'change']
							});
						}
					}

					// 文件大小验证
					if (field.type === 'file' && field.maxSize) {
						fieldRules.push({
							validator: (rule, value, callback) => {
								if (value && value.length > 0) {
									const oversizedFiles = value.filter(file =>
										file.size > field.maxSize * 1024 * 1024
									);
									if (oversizedFiles.length > 0) {
										callback(new Error(`文件大小不能超过${field.maxSize}MB`));
										return;
									}
								}
								callback();
							},
							trigger: ['change']
						});
					}

					// 文件数量验证
					if (field.type === 'file' && field.maxCount) {
						fieldRules.push({
							validator: (rule, value, callback) => {
								if (value && value.length > field.maxCount) {
									callback(new Error(`最多只能上传${field.maxCount}个文件`));
									return;
								}
								callback();
							},
							trigger: ['change']
						});
					}

					// 表格验证
					if (field.type === 'table') {
						if (field.minRows) {
							fieldRules.push({
								validator: (rule, value, callback) => {
									if (!value || value.length < field.minRows) {
										callback(new Error(`至少需要${field.minRows}条记录`));
										return;
									}
									callback();
								},
								trigger: ['change']
							});
						}
					}

					if (fieldRules.length > 0) {
						rules[fieldKey] = fieldRules;
					}
				});

				this.form.props.rules = rules;
			},

			// 转换字段为 columns 格式			
			convertFieldsToColumns() {
				if (!this.formSchema || !this.formSchema.fields) return [];

				const columns = [];
				let column = {};
				let columnTitle = {};

				// 处理布局
				if (this.formSchema.layout && this.formSchema.layout.groups) {
					this.formSchema.layout.groups.forEach((e) => {
						columnTitle = [];
						const obj = {
							key: "",
							title: e.title,
							type: "bar-title"
						}
						columnTitle = obj;
						columns.push(columnTitle);

						this.formSchema.fields.forEach(field => {
							//是否是分组的field
							const group = e;
							if (group.fields && group.fields.includes(field.name)) {
								column = {
									key: field.name, // 直接使用字段名，不使用 form_data. 前缀
									title: field.label,
									type: this.convertFieldType(field.type),
									width: 200,
									required: field.required || false
								};

								if (group.fullWidth) {
									column.oneLine = true;
									// 对于全宽字段，设置与 textarea 相同的宽度
									if (field.type === 'file' || field.type === 'table' || field.type ===
										'array<object>') {
										column.width = 630;
									}
								}

								// 添加公共属性
								if (field.placeholder) {
									column.placeholder = field.placeholder;
								}

								if (field.defaultValue !== undefined && field.defaultValue !== null) {
									column.defaultValue = field.defaultValue;
								}

								// 处理watch配置 - 修改为函数名引用
								if (field.watch) {
									// 如果watch是字符串，从watchHandlers中获取对应的函数
									if (typeof field.watch === 'string' && this.watchHandlers[field
											.watch]) {
										column.watch = this.watchHandlers[field.watch];
									}
									// 如果watch已经是函数，直接使用
									else if (typeof field.watch === 'function') {
										column.watch = field.watch;
									}
								}

								// 处理disabled状态
								if (field.disabled) {
									column.disabled = true;
								}

								// 根据字段类型添加特定属性
								switch (field.type) {
									case 'text':
										if (field.maxLength) {
											column.maxlength = field.maxLength;
											column.showWordLimit = true;
										}
										break;

									case 'number':
										column.type = 'number';
										if (field.min !== undefined) column.min = field.min;
										if (field.max !== undefined) column.max = field.max;
										if (field.placeholder) column.placeholder = field.placeholder;
										break;

									case 'select':
										column.data = field.options || [];
										if (field.placeholder) column.placeholder = field.placeholder;
										break;

									case 'textarea':
										column.type = 'textarea';
										column.width = 630;
										column.oneLine = true;
										if (field.rows) {
											column.autosize = {
												minRows: field.rows,
												maxRows: field.rows * 2
											};
										}
										if (field.maxLength) {
											column.maxlength = field.maxLength;
											column.showWordLimit = true;
										}
										break;

									case 'date':
										column.dateType = 'date';
										column.valueFormat = 'yyyy-MM-dd';
										column.pickerOptions = {
											disabledDate: (time) => {
												return time.getTime() < Date.now() - 8.64e7;
											}
										}
										break;

									case 'file':
										column.oneLine = true;
										column.type = 'upload';
										column.width = 630; // 设置与 textarea 相同的宽度
										column.action = 'admin/upload/file';
										column.multiple = (field.multiple !== false);
										column.limit = field.maxCount || 10;
										column.accept = field.accept || '*';
										column.props = {
											value: "url",
											label: "name"
										};
										break;

									case 'radio':
										column.data = field.options || [];
										break;

									case 'remote-select':
										column.type = 'remote-select';
										if (field.action) column.action = field.action;
										if (field.props) column.props = field.props;
										if (field.actionData) column.actionData = field.actionData;
										if (field.showAll !== undefined) column.showAll = field.showAll;
										break;

									case 'tree-select':
										column.type = 'tree-select';
										if (field.action) column.action = field.action;
										if (field.props) column.props = field.props;
										if (field.actionData) column.actionData = field.actionData;
										break;

									case 'table-select':
										column.type = 'table-select';
										if (field.action) column.action = field.action;
										if (field.multiple !== undefined) column.multiple = field.multiple;
										if (field.columns) column.columns = field.columns;
										if (field.queryColumns) column.queryColumns = field.queryColumns;
										break;

									case 'cascader':
										column.type = 'cascader';
										if (field.action) column.action = field.action;
										if (field.props) column.props = field.props;
										if (field.placeholder) column.placeholder = field.placeholder;
										if (field.checkStrictly) column.checkStrictly = filed
											.checkStrictly;
										break;

									case 'array<object>':
										column.type = 'array<object>';
										column.oneLine = true;
										column.width = 630;

										// 设置 array<object> 的特定属性
										if (field.itemWidth !== undefined) column.itemWidth = field
											.itemWidth;
										//序号宽度
										if (field.columnIndexWidth !== undefined) column.columnIndexWidth =
											field
											.columnIndexWidth;
										if (field.showAdd !== undefined) column.showAdd = field.showAdd;
										if (field.showClear !== undefined) column.showClear = field
											.showClear;
										if (field.showSort !== undefined) column.showSort = field.showSort;
										if (field.defaultValue !== undefined) column.defaultValue = field
											.defaultValue;
										if (field.rightBtns !== undefined) column.rightBtns = field
											.rightBtns;

										// 处理子列
										if (field.columns) {
											column.columns = field.columns
												.filter(subColumn => subColumn.show !==
													false) // 过滤 show 为 false 的字段
												.map(subColumn => {
													const subCol = {
														key: subColumn.key,
														title: subColumn.title,
														type: this.convertFieldType(subColumn
															.type),
														width: subColumn.width || 120,
														isUnique: subColumn.isUnique || false,
														required: subColumn.required || false														
													};

													// 根据子列类型添加特定属性
													switch (subColumn.type) {
														case 'table-select':
															subCol.type = 'table-select';
															if (subColumn.action) subCol.action =
																subColumn.action;
															if (subColumn.multiple !== undefined)
																subCol.multiple = subColumn.multiple;
															if (subColumn.columns) subCol.columns =
																subColumn.columns;
															if (subColumn.queryColumns) subCol
																.queryColumns = subColumn.queryColumns;
															if (subColumn.placeholder) subCol
																.placeholder = subColumn.placeholder;
															break;
														case 'tree-select':
															subCol.type = 'tree-select';
															if (subColumn.action) subCol.action =
																subColumn.action;
															if (subColumn.props) subCol.props =
																subColumn.props;
															if (subColumn.actionData) subCol
																.actionData = subColumn.actionData;
															if (subColumn.placeholder) subCol
																.placeholder = subColumn.placeholder;
															break;
														case 'remote-select':
															subCol.type = 'remote-select';
															if (subColumn.action) subCol.action =
																subColumn.action;
															if (subColumn.props) subCol.props =
																subColumn.props;
															if (subColumn.actionData) subCol
																.actionData = subColumn.actionData;
															if (subColumn.showAll !== undefined) subCol
																.showAll = subColumn.showAll;
															if (subColumn.placeholder) subCol
																.placeholder = subColumn.placeholder;
															break;
														case 'cascader':
															subCol.type = 'cascader';
															if (subColumn.action) subCol.action =
																subColumn.action;
															if (subColumn.props) subCol.props =
																subColumn.props;
															if (subColumn.placeholder) subCol
																.placeholder = subColumn.placeholder;
															if (subColumn.checkStrictly) subCol
																.checkStrictly = subColumn
																.checkStrictly;
															break;
														case 'select':
															subCol.data = subColumn.data || [];
															break;
														case 'text':
															if (subColumn.placeholder) subCol
																.placeholder = subColumn.placeholder;
															if (subColumn.maxLength) {
																subCol.maxlength = subColumn.maxLength;
																subCol.showWordLimit = true;
															}
															if (subColumn.disabled !== undefined) {
																subCol.disabled = subColumn.disabled;
															}
															break;
														case 'number':
															subCol.type = 'number';
															subCol.width = 100;
															if (subColumn.min !== undefined) subCol
																.min = subColumn.min;
															if (subColumn.max !== undefined) subCol
																.max = subColumn.max;
															break;
													}

													// 处理子列的验证规则
													if (subColumn.rules) {
														subCol.rules = subColumn.rules.map(rule => {
															if (rule.validator && typeof rule
																.validator === 'string') {
																// 从watchHandlers中获取验证函数
																if (this.watchHandlers[rule
																		.validator]) {
																	return {
																		...rule,
																		validator: this
																			.watchHandlers[rule
																				.validator]
																			.bind(this)
																	};
																}
															}
															return rule;
														});
													}

													// 处理子列的watch配置 - 修改为函数名引用
													if (subColumn.watch) {
														// 如果watch是字符串，从watchHandlers中获取对应的函数
														if (typeof subColumn.watch === 'string' && this
															.watchHandlers[subColumn.watch]) {
															subCol.watch = this.watchHandlers[subColumn
																.watch];
														}
														// 如果watch已经是函数，直接使用
														else if (typeof subColumn.watch ===
															'function') {
															subCol.watch = subColumn.watch;
														}
													}
													return subCol;
												});
										}
										break;
								}
								columns.push(column);
							}
						})
					})
				}

				return columns;
			},

			// 转换字段类型
			convertFieldType(type) {
				const typeMap = {
					'text': 'text',
					'number': 'number',
					'select': 'select',
					'textarea': 'textarea',
					'date': 'date',
					'file': 'upload',
					'radio': 'radio',
					'remote-select': 'remote-select',
					'tree-select': 'tree-select',
					'table-select': 'table-select',
					'array<object>': 'array<object>',
					'cascader': 'cascader'
				};
				return typeMap[type] || 'text';
			},

			// 表单成功回调
			handleSuccess() {
				this.form.props.show = false;
				this.$emit('success');
				this.$emit('input', false);
			},

			// 取消操作
			handleCancel() {
				this.form.props.show = false;
				this.$emit('cancel');
				this.$emit('input', false);
			},

			// 保存草稿
			async handleSave(status) {
				this.$refs.formRef.validate((isValid) => {
					if (!isValid) {
						this.$message.error('请完善表单信息');
						return;
					}
					this.saveLoadingLocal = true;
					try {
						// 手动整理数据，确保所有动态字段都在 form_data 中
						const processedData = this.processFormData();
						const formData = {
							...processedData
						};
						if (status) {
							formData.status = status;
						}
						console.log('保存的数据:', formData);
						this.$emit('save', formData);
					} catch (error) {
						console.error('保存失败:', error);
						this.$message.error('保存失败');
						this.$emit('error', error);
					} finally {
						this.saveLoadingLocal = false;
					}
				})
			},

			// 提交申请
			async handleSubmit() {
				this.$refs.formRef.validate((isValid) => {
					if (!isValid) {
						this.$message.error('请完善表单信息');
						return;
					}
					this.submitLoadingLocal = true;
					try {
						// 手动整理数据，确保所有动态字段都在 form_data 中
						const processedData = this.processFormData();
						const formData = {
							...processedData,
							status: 'pending'
						};
						console.log('提交的数据:', formData);
						this.$emit('submit', formData);
					} catch (error) {
						console.error('提交失败:', error);
						this.$message.error('提交失败');
						this.$emit('error', error);
					} finally {
						this.submitLoadingLocal = false;
					}
				})
			},

			// 试算流程
			async handleSimulate() {
				this.$refs.formRef.validate((isValid) => {
					if (!isValid) {
						this.$message.error('请完善表单信息');
						return;
					}
					this.simulateLoadingLocal = true;
					try {
						// 手动整理数据，确保所有动态字段都在 form_data 中
						const processedData = this.processFormData();
						const formData = {
							...processedData
						};
						console.log('试算的数据:', formData);
						this.$emit('simulate', formData);
					} catch (error) {
						console.error('试算失败:', error);
						this.$message.error('试算失败');
						this.$emit('error', error);
					} finally {
						this.simulateLoadingLocal = false;
					}
				})
			},

			// 处理表单数据，确保动态字段都在 form_data 中
			processFormData() {
				if (!this.formSchema || !this.formSchema.fields) return this.form.data;

				const result = {
					form_type_code: this.form.data.form_type_code,
					form_data: {},
					...this.form.data
				};

				// 确保 form_data 存在
				if (!result.form_data) {
					result.form_data = {};
				}

				// 将所有动态字段移动到 form_data 中
				this.formSchema.fields.forEach(field => {
					const fieldName = field.name;
					if (this.form.data[fieldName] !== undefined) {
						result.form_data[fieldName] = this.form.data[fieldName];
						// 删除顶层的字段
						delete result[fieldName];
					} else if (this.form.data.form_data && this.form.data.form_data[fieldName] !== undefined) {
						// 如果字段已经在 form_data 中，直接复制
						result.form_data[fieldName] = this.form.data.form_data[fieldName];
					}
				});

				return result;
			},

			// 重置表单
			resetForm() {
				this.initFormData();
			},

			// 字段相关方法
			getFieldLabel(fieldName) {
				if (!this.formSchema || !this.formSchema.fields) return fieldName;
				const field = this.formSchema.fields.find(f => f.name === fieldName);
				return field ? field.label : fieldName;
			},

			getFieldType(fieldName) {
				if (!this.formSchema || !this.formSchema.fields) return 'text';
				const field = this.formSchema.fields.find(f => f.name === fieldName);
				return field ? field.type : 'text';
			},

			// 文件上传相关方法 - 保持不变
			getFieldAccept(fieldName) {
				if (!this.formSchema || !this.formSchema.fields) return '*';
				const field = this.formSchema.fields.find(f => f.name === fieldName);
				return field ? field.accept : '*';
			},

			getFileMaxSize(fieldName) {
				if (!this.formSchema || !this.formSchema.fields) return 50;
				const field = this.formSchema.fields.find(f => f.name === fieldName);
				return field ? (field.maxSize || 50) : 50;
			},

			getFileMaxCount(fieldName) {
				if (!this.formSchema || !this.formSchema.fields) return 10;
				const field = this.formSchema.fields.find(f => f.name === fieldName);
				return field ? (field.maxCount || 10) : 10;
			},

			getFileMultiple(fieldName) {
				if (!this.formSchema || !this.formSchema.fields) return true;
				const field = this.formSchema.fields.find(f => f.name === fieldName);
				return field ? (field.multiple !== false) : true;
			},

			getFileDescription(fieldName) {
				if (!this.formSchema || !this.formSchema.fields) return '请上传文件';
				const field = this.formSchema.fields.find(f => f.name === fieldName);
				return field ? (field.description || '请上传文件') : '请上传文件';
			},

			beforeUpload(file) {
				const maxSize = this.getFileMaxSize('file_attachments') * 1024 * 1024;
				if (file.size > maxSize) {
					this.$message.error(`文件大小不能超过 ${this.getFileMaxSize('file_attachments')}MB`);
					return false;
				}
				return true;
			},

			handleExceed(files, fileList) {
				this.$message.warning(`最多只能上传 ${this.getFileMaxCount('file_attachments')} 个文件`);
			},

			onUploadSuccess(response, file, fileList, fieldName) {
				this.$message.success('文件上传成功');

				if (!this.form.data.form_data[fieldName]) {
					this.$set(this.form.data.form_data, fieldName, []);
				}

				const fileInfo = {
					uid: file.uid,
					name: file.name,
					url: response.url || file.url,
					size: file.size,
					type: file.type,
					uploadTime: Date.now()
				};

				this.form.data.form_data[fieldName].push(fileInfo);
			},

			onUploadRemove(file, fileList, fieldName) {
				if (this.form.data.form_data[fieldName]) {
					const index = this.form.data.form_data[fieldName].findIndex(f => f.uid === file.uid);
					if (index > -1) {
						this.form.data.form_data[fieldName].splice(index, 1);
					}
				}
			},

			onUploadPreview(file) {
				this.previewFile(file);
			},

			onUploadError(error, file, fileList) {
				console.error('文件上传失败:', error);
				this.$message.error('文件上传失败: ' + (error.message || '未知错误'));
			},

			removeFile(fieldName, index) {
				if (this.form.data.form_data[fieldName] && this.form.data.form_data[fieldName][index]) {
					this.form.data.form_data[fieldName].splice(index, 1);
					this.$message.success('文件删除成功');
				}
			},

			previewFile(file) {
				if (!file || !file.url) {
					this.$message.warning('文件地址无效');
					return;
				}
				this.$emit('preview-file', file);
			},

			downloadFile(file) {
				if (!file || !file.url) {
					this.$message.warning('文件地址无效');
					return;
				}
				const link = document.createElement('a');
				link.href = file.url;
				link.download = file.name || 'download';
				link.style.display = 'none';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				this.$message.success('开始下载文件');
			},

			formatFileSize(bytes) {
				if (!bytes) return '0 B';
				const k = 1024;
				const sizes = ['B', 'KB', 'MB', 'GB'];
				const i = Math.floor(Math.log(bytes) / Math.log(k));
				return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
			}
		}
	};
</script>

<style lang="scss" scoped>
	// 文件上传样式 - 调整宽度与 textarea 一致
	.file-upload-container {
		width: 630px; // 设置与 textarea 相同的宽度

		// 上传按钮左对齐
		::v-deep .el-upload {
			width: auto;
			text-align: left;

			.upload-button {
				margin-right: 10px;
			}
		}

		::v-deep .el-upload-list {
			width: 100%;
			text-align: left;
		}

		.file-list {
			margin-top: 12px;
			border: 1px solid #e4e7ed;
			border-radius: 4px;
			padding: 12px;
			background: #fafafa;
			width: 100%;
			box-sizing: border-box;

			.file-item {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 8px;
				margin-bottom: 8px;
				background: white;
				border-radius: 4px;
				border: 1px solid #e4e7ed;
				width: 100%;
				box-sizing: border-box;

				&:last-child {
					margin-bottom: 0;
				}

				.file-info {
					display: flex;
					align-items: center;
					flex: 1;
					min-width: 0; // 防止内容溢出

					.file-icon {
						color: #409eff;
						margin-right: 8px;
						font-size: 16px;
						flex-shrink: 0;
					}

					.file-name {
						flex: 1;
						color: #303133;
						font-size: 14px;
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
						min-width: 0;
					}

					.file-size {
						color: #909399;
						font-size: 12px;
						margin-left: 8px;
						flex-shrink: 0;
					}
				}

				.file-actions {
					display: flex;
					align-items: center;
					flex-shrink: 0;

					.el-button {
						margin-left: 8px;
					}

					.delete-btn {
						color: #f56c6c;
					}
				}
			}
		}
	}

	// 确保表单布局正确
	::v-deep .vk-data-form {
		.form-item {
			&.one-line {
				.el-form-item__content {
					width: 630px; // 确保全宽字段的宽度一致
				}
			}
		}
	}
</style>