<template>
	<view class="page-body">
		<!-- 页面内容开始 -->

		<!-- 表格搜索组件开始 -->
		<vk-data-table-query v-model="queryForm1.formData" :columns="queryForm1.columns"
			@search="search"></vk-data-table-query>
		<!-- 表格搜索组件结束 -->

		<!-- 自定义按钮区域开始 -->
		<view class="button-group">
			<el-row>
				<el-button type="success" size="small" icon="el-icon-circle-plus-outline"
					v-if="$hasRole('admin') || $hasPermission('bpmn-workflow-add')" @click="addBtn">
					添加条件规则
				</el-button>
				<el-button type="warning" size="small" icon="el-icon-refresh" @click="refresh">
					刷新
				</el-button>
			</el-row>
		</view>
		<!-- 自定义按钮区域结束 -->

		<!-- 表格组件开始 -->
		<vk-data-table ref="table1" :action="table1.action" :columns="table1.columns" :query-form-param="queryForm1"
			:right-btns="table1.rightBtns" :selection="true" :row-no="false" :pagination="true" @update="updateBtn"
			@delete="deleteBtn" @current-change="currentChange" @selection-change="selectionChange"></vk-data-table>
		<!-- 表格组件结束 -->

		<!-- 添加或编辑的弹窗开始 -->
		<vk-data-dialog v-model="form1.props.show" :title="form1.props.title" width="1000px" mode="form"
			:close-on-click-modal="false" custom-class="condition-rule-dialog">
			<div class="dialog-content">
				<el-form :model="form1.data" :rules="form1.props.rules" ref="formRef" label-width="130px"
					class="condition-form">
					<!-- 基础信息区域 -->
					<el-card shadow="never" class="form-section">
						<div slot="header" class="section-header">
							<span class="section-title">基础信息</span>
						</div>
						<el-row :gutter="24">
							<el-col :span="12">
								<el-form-item label="规则编码" prop="code">
									<el-input v-model="form1.data.code" placeholder="请输入规则编码，如：RULE_SEAL_URGENT" 
										maxlength="50" show-word-limit>
										<template slot="prepend">RULE_</template>
									</el-input>
									<div class="form-tip">规则编码需唯一，建议使用大写英文和下划线</div>
								</el-form-item>
							</el-col>
							<el-col :span="12">
								<el-form-item label="规则名称" prop="name">
									<el-input v-model="form1.data.name" placeholder="请输入规则名称" maxlength="100"
										show-word-limit></el-input>
								</el-form-item>
							</el-col>
						</el-row>
						<el-form-item label="规则描述">
							<el-input v-model="form1.data.description" type="textarea" placeholder="请输入规则描述" :rows="2"
								maxlength="500" show-word-limit></el-input>
						</el-form-item>
					</el-card>

					<!-- 条件配置区域 -->
					<el-card shadow="never" class="form-section">
						<div slot="header" class="section-header">
							<span class="section-title">条件配置</span>
							<div class="section-actions">
								<el-radio-group v-model="form1.data.rule_expression.type" size="small" @change="onRuleTypeChange">
									<el-radio-button label="simple">简单规则</el-radio-button>
									<el-radio-button label="composite">复合规则</el-radio-button>
								</el-radio-group>
								<el-radio-group v-model="form1.data.rule_expression.logic" size="small"
									v-if="form1.data.rule_expression.type === 'composite'" style="margin-left: 12px;">
									<el-radio-button label="and">并且 (AND)</el-radio-button>
									<el-radio-button label="or">或者 (OR)</el-radio-button>
								</el-radio-group>
								<el-button type="text" icon="el-icon-question" size="small" style="margin-left: 12px;"
									@click="showRuleHelp">
									规则说明
								</el-button>
							</div>
						</div>

						<!-- 条件预览 -->
						<div class="rule-preview" v-if="form1.data.rule_expression.conditions.length > 0">
							<div class="preview-title">条件预览：</div>
							<div class="preview-content">
								{{ formatRulePreview() }}
							</div>
						</div>

						<el-form-item prop="rule_expression.conditions" class="no-margin-form-item">
							<div class="conditions-container">
								<div class="condition-list">
									<div class="condition-item"
										v-for="(condition, index) in form1.data.rule_expression.conditions"
										:key="index">
										<div class="condition-header">
											<span class="condition-index">条件 {{ index + 1 }}</span>
											<el-button type="danger" icon="el-icon-delete" size="mini"
												@click="removeCondition(index)" class="condition-remove-btn"
												v-if="form1.data.rule_expression.conditions.length > 1">
												删除
											</el-button>
										</div>
										<div class="condition-content">
											<el-row :gutter="12" class="condition-row">
												<el-col :span="5">
													<el-form-item :prop="`rule_expression.conditions[${index}].field`"
														:rules="fieldRules" class="inline-form-item">
														<el-select v-model="condition.field" placeholder="选择字段"
															@change="onFieldChange(condition)" size="small" 
															filterable>
															<el-option-group v-for="group in fieldGroups" :key="group.label" :label="group.label">
																<el-option v-for="field in group.options" :key="field.value"
																	:label="field.label" :value="field.value">
																	<div class="field-option">
																		<div class="field-name">{{ field.label }}</div>
																		<div class="field-desc">{{ field.description }}</div>
																	</div>
																</el-option>
															</el-option-group>
														</el-select>
													</el-form-item>
												</el-col>
												<el-col :span="4">
													<el-form-item :prop="`rule_expression.conditions[${index}].operator`"
														:rules="operatorRules" class="inline-form-item">
														<el-select v-model="condition.operator" placeholder="操作符"
															size="small">
															<el-option v-for="op in getAvailableOperators(condition.field)" 
																:key="op.value" :label="op.label" :value="op.value"
																:disabled="op.disabled">
															</el-option>
														</el-select>
													</el-form-item>
												</el-col>
												<el-col :span="10">
													<el-form-item :prop="`rule_expression.conditions[${index}].value`"
														:rules="valueRules" class="inline-form-item">
														<!-- 动态值输入组件 -->
														<component 
															:is="getValueComponent(condition)"
															v-model="condition.value"
															:placeholder="getValuePlaceholder(condition)"
															:options="getFieldOptions(condition.field)"
															:multiple="isMultipleOperator(condition.operator)"
															size="small"
															style="width: 100%">
														</component>
													</el-form-item>
												</el-col>
												<el-col :span="3">
													<el-form-item :prop="`rule_expression.conditions[${index}].value_type`"
														:rules="valueTypeRules" class="inline-form-item">
														<el-select v-model="condition.value_type" placeholder="值类型"
															size="small" @change="onValueTypeChange(condition)">
															<el-option v-for="type in valueTypes" :key="type.value"
																:label="type.label" :value="type.value">
															</el-option>
														</el-select>
													</el-form-item>
												</el-col>
												<el-col :span="2" class="condition-actions">
													<el-tooltip content="测试条件" placement="top">
														<el-button type="info" icon="el-icon-view" circle size="mini"
															@click="testCondition(condition)">
														</el-button>
													</el-tooltip>
												</el-col>
											</el-row>
											<!-- 值类型说明 -->
											<div class="value-type-tip" v-if="condition.value_type">
												值类型：{{ getValueTypeDescription(condition.value_type) }}
											</div>
										</div>
										<!-- 条件连接符 -->
										<div class="condition-connector"
											v-if="form1.data.rule_expression.type === 'composite' && index < form1.data.rule_expression.conditions.length - 1">
											<div class="connector-line"></div>
											<div class="connector-text">
												<el-tag size="small" :type="form1.data.rule_expression.logic === 'and' ? 'success' : 'warning'">
													{{ form1.data.rule_expression.logic === 'and' ? '并且 (AND)' : '或者 (OR)' }}
												</el-tag>
											</div>
											<div class="connector-line"></div>
										</div>
									</div>
								</div>

								<div class="condition-actions-bottom">
									<el-button type="primary" icon="el-icon-plus" @click="addCondition"
										class="add-condition-btn" size="small">
										添加条件
									</el-button>
									<el-button type="text" @click="addConditionGroup" size="small"
										v-if="form1.data.rule_expression.type === 'composite'">
										添加条件组
									</el-button>
								</div>
							</div>
						</el-form-item>
					</el-card>

					<!-- 适用范围配置 -->
					<el-card shadow="never" class="form-section">
						<div slot="header" class="section-header">
							<span class="section-title">适用范围</span>
							<el-switch v-model="enableScope" active-text="启用范围限制" inactive-text="禁用范围限制">
							</el-switch>
						</div>
						<el-row :gutter="24" v-if="enableScope">
							<el-col :span="12">
								<el-form-item label="适用表单类型">
									<el-select v-model="form1.data.scope.form_types" multiple placeholder="请选择适用的表单类型"
										style="width: 100%" filterable clearable>
										<el-option v-for="formType in formTypes" :key="formType.value"
											:label="formType.label" :value="formType.value">
											<div class="option-item">
												<div class="option-name">{{ formType.label }}</div>
												<div class="option-code">{{ formType.value }}</div>
											</div>
										</el-option>
									</el-select>
									<div class="form-tip">不选择表示适用于所有表单类型</div>
								</el-form-item>
							</el-col>
							<el-col :span="12">
								<el-form-item label="适用部门">
									<el-select v-model="form1.data.scope.departments" multiple placeholder="请选择适用的部门"
										style="width: 100%" filterable clearable>
										<el-option v-for="dept in departments" :key="dept.value" :label="dept.label"
											:value="dept.value">
										</el-option>
									</el-select>
									<div class="form-tip">不选择表示适用于所有部门</div>
								</el-form-item>
							</el-col>
						</el-row>
						<div v-else class="scope-disabled-tip">
							<el-alert title="适用范围限制已禁用，此规则将适用于所有表单和部门" type="info" :closable="false" show-icon>
							</el-alert>
						</div>
					</el-card>

					<!-- 状态配置 -->
					<el-card shadow="never" class="form-section">
						<div slot="header" class="section-header">
							<span class="section-title">状态设置</span>
						</div>
						<el-form-item label="规则状态" prop="status">
							<el-radio-group v-model="form1.data.status">
								<el-radio label="active" border>启用</el-radio>
								<el-radio label="inactive" border>停用</el-radio>
							</el-radio-group>
							<div class="form-tip">停用的规则不会在流程路由中使用</div>
						</el-form-item>
					</el-card>
				</el-form>
			</div>

			<template #footer>
				<div class="dialog-footer">
					<el-button @click="form1.props.show = false" size="medium">取消</el-button>
					<el-button type="primary" @click="submitForm" :loading="formLoading" size="medium">
						{{ form1.props.formType === 'add' ? '创建规则' : '更新规则' }}
					</el-button>
					<el-button type="success" @click="saveAndTest" :loading="formLoading" size="medium">
						保存并测试
					</el-button>
				</div>
			</template>
		</vk-data-dialog>
		<!-- 添加或编辑的弹窗结束 -->

		<!-- 规则说明弹窗 -->
		<el-dialog title="条件规则说明" :visible.sync="ruleHelpVisible" width="600px">
			<div class="rule-help-content">
				<h3>条件规则配置指南</h3>
				<el-divider></el-divider>
				
				<h4>1. 规则类型</h4>
				<ul>
					<li><strong>简单规则</strong>：单个条件或多个条件的组合</li>
					<li><strong>复合规则</strong>：支持 AND/OR 逻辑组合的复杂条件</li>
				</ul>

				<h4>2. 值类型说明</h4>
				<ul>
					<li><strong>常量</strong>：固定的值，如："紧急"、100</li>
					<li><strong>变量</strong>：引用流程变量，如：${applicant.department}</li>
					<li><strong>表达式</strong>：JavaScript表达式，如：amount > 1000</li>
				</ul>

				<h4>3. 操作符说明</h4>
				<el-table :data="operatorHelpData" size="small" border>
					<el-table-column prop="operator" label="操作符" width="100"></el-table-column>
					<el-table-column prop="description" label="说明"></el-table-column>
					<el-table-column prop="example" label="示例" width="200"></el-table-column>
				</el-table>
			</div>
			<span slot="footer" class="dialog-footer">
				<el-button @click="ruleHelpVisible = false" size="small">关闭</el-button>
			</span>
		</el-dialog>

		<!-- 页面内容结束 -->
	</view>
</template>

<script>
	let vk = uni.vk; // vk实例
	let originalForms = {}; // 表单初始化数据
	const colWidth = 200;

	// 动态值输入组件
	const ValueInput = {
		props: ['value', 'placeholder', 'options', 'multiple'],
		render(h) {
			if (this.options && this.options.length > 0) {
				return h('el-select', {
					props: {
						value: this.value,
						placeholder: this.placeholder,
						multiple: this.multiple,
						filterable: true,
						clearable: true
					},
					on: {
						input: (value) => this.$emit('input', value)
					}
				}, this.options.map(option => 
					h('el-option', {
						props: {
							label: option.label,
							value: option.value
						}
					})
				));
			} else {
				return h('el-input', {
					props: {
						value: this.value,
						placeholder: this.placeholder,
						clearable: true
					},
					on: {
						input: (value) => this.$emit('input', value)
					}
				});
			}
		}
	};

	export default {
		components: {
			ValueInput
		},
		data() {
			// 验证规则
			const fieldRules = [{ required: true, message: '请选择字段', trigger: 'change' }];
			const operatorRules = [{ required: true, message: '请选择操作符', trigger: 'change' }];
			const valueRules = [{ required: true, message: '请输入值', trigger: 'change' }];
			const valueTypeRules = [{ required: true, message: '请选择值类型', trigger: 'change' }];

			return {
				loading: false,
				formLoading: false,
				ruleHelpVisible: false,
				enableScope: true,

				// 验证规则
				fieldRules,
				operatorRules,
				valueRules,
				valueTypeRules,

				// 字段分组配置
				fieldGroups: [
					{
						label: '用印相关字段',
						options: [
							{ value: 'seal_type', label: '用印类型', description: '印章类型', type: 'select' },
							{ value: 'file_type', label: '文件类型', description: '文件分类', type: 'select' },
							{ value: 'copies', label: '用印份数', description: '盖章数量', type: 'number' },
							{ value: 'urgency_level', label: '紧急程度', description: '紧急级别', type: 'select' },
							{ value: 'amount', label: '涉及金额', description: '金额数值', type: 'number' }
						]
					},
					{
						label: '申请人信息',
						options: [
							{ value: 'department_code', label: '部门编码', description: '申请人部门', type: 'string' },
							{ value: 'position_level', label: '职位级别', description: '职级', type: 'number' },
							{ value: 'employee_level', label: '员工级别', description: '员工等级', type: 'number' },
							{ value: 'work_years', label: '工作年限', description: '司龄', type: 'number' }
						]
					},
					{
						label: '系统字段',
						options: [
							{ value: '_add_time', label: '创建时间', description: '申请时间', type: 'date' },
							{ value: 'applicant_role', label: '申请人角色', description: '用户角色', type: 'select' }
						]
					}
				],

				// 操作符配置
				operators: {
					string: [
						{ value: 'eq', label: '等于' },
						{ value: 'ne', label: '不等于' },
						{ value: 'contains', label: '包含' },
						{ value: 'not_contains', label: '不包含' },
						{ value: 'regex', label: '正则匹配' }
					],
					number: [
						{ value: 'eq', label: '等于' },
						{ value: 'ne', label: '不等于' },
						{ value: 'gt', label: '大于' },
						{ value: 'gte', label: '大于等于' },
						{ value: 'lt', label: '小于' },
						{ value: 'lte', label: '小于等于' },
						{ value: 'between', label: '介于之间', disabled: true }
					],
					select: [
						{ value: 'eq', label: '等于' },
						{ value: 'ne', label: '不等于' },
						{ value: 'in', label: '包含任一' },
						{ value: 'not_in', label: '不包含任一' }
					],
					date: [
						{ value: 'eq', label: '等于' },
						{ value: 'ne', label: '不等于' },
						{ value: 'gt', label: '晚于' },
						{ value: 'gte', label: '晚于或等于' },
						{ value: 'lt', label: '早于' },
						{ value: 'lte', label: '早于或等于' }
					]
				},

				// 值类型配置
				valueTypes: [
					{ value: 'constant', label: '常量' },
					{ value: 'variable', label: '变量' },
					{ value: 'expression', label: '表达式' }
				],

				// 字段选项配置
				fieldOptions: {
					seal_type: [
						{ value: 'company_seal', label: '公司公章' },
						{ value: 'contract_seal', label: '合同专用章' },
						{ value: 'finance_seal', label: '财务专用章' },
						{ value: 'legal_seal', label: '法人章' },
						{ value: 'hr_seal', label: '人事专用章' }
					],
					file_type: [
						{ value: 'contract', label: '合同/协议' },
						{ value: 'certificate', label: '证明文件' },
						{ value: 'application', label: '申请文件' },
						{ value: 'report', label: '报告文件' },
						{ value: 'other', label: '其他文件' }
					],
					urgency_level: [
						{ value: 'normal', label: '普通' },
						{ value: 'urgent', label: '紧急' },
						{ value: 'very_urgent', label: '特急' }
					],
					applicant_role: [
						{ value: 'employee', label: '普通员工' },
						{ value: 'manager', label: '部门经理' },
						{ value: 'director', label: '总监' },
						{ value: 'admin', label: '管理员' }
					]
				},

				// 操作符帮助数据
				operatorHelpData: [
					{ operator: 'eq', description: '等于', example: '部门 = "技术部"' },
					{ operator: 'ne', description: '不等于', example: '部门 ≠ "人事部"' },
					{ operator: 'gt', description: '大于', example: '金额 > 1000' },
					{ operator: 'gte', description: '大于等于', example: '金额 ≥ 5000' },
					{ operator: 'lt', description: '小于', example: '天数 < 30' },
					{ operator: 'lte', description: '小于等于', example: '级别 ≤ 3' },
					{ operator: 'contains', description: '包含文本', example: '事由包含 "紧急"' },
					{ operator: 'in', description: '包含任一', example: '类型 in ["公章", "合同章"]' },
					{ operator: 'not_in', description: '不包含任一', example: '部门 not_in ["财务部"]' }
				],

				// 表单类型数据
				formTypes: [],
				// 部门数据
				departments: [],

				// 表格配置
				table1: {
					action: "admin/bpmn/condition-rule/sys/getList",
					rightBtns: [
						{
							title: '详细',
							mode: 'detail_auto',
							show: (item) => this.$hasRole('admin') || this.$hasPermission('bpmn-workflow-view'),
							onClick: (item) => this.showDetail(item)
						},
						{
							title: '编辑',
							mode: 'update',
							show: (item) => this.$hasRole('admin') || this.$hasPermission('bpmn-workflow-edit'),
							onClick: (item) => this.updateBtn({ item })
						},
						{
							title: '删除',
							mode: 'delete',
							show: (item) => this.$hasRole('admin') || this.$hasPermission('bpmn-workflow-delete'),
							onClick: (item) => this.deleteBtn({ item })
						},
						{
							title: '测试',
							type: 'success',
							show: (item) => this.$hasRole('admin') || $hasPermission('bpmn-workflow-edit'),
							onClick: (item) => this.testRule(item)
						}
					],
					columns: [
						{
							"key": "code",
							"title": "规则编码",
							"type": "text",
							"width": colWidth+50,
							"fixed": "left"
						},
						{
							"key": "name",
							"title": "规则名称",
							"type": "text",
							"width": colWidth
						},
						{
							"key": "rule_expression",
							"title": "条件配置",
							"type": "text",
							"width": colWidth,
							"render": (value) => {
								if (!value || !value.conditions) return '-';
								const conditionCount = value.conditions.length;
								const typeText = value.type === 'simple' ? '简单' : '复合';
								const logicText = value.logic === 'and' ? '且' : '或';
								return `${conditionCount}条件${value.type === 'composite' ? ` (${logicText})` : ''}`;
							}
						},
						{
							"key": "scope",
							"title": "适用范围",
							"type": "text",
							"width": colWidth,
							"render": (value) => {
								if (!value) return '全部';
								const formCount = value.form_types ? value.form_types.length : 0;
								const deptCount = value.departments ? value.departments.length : 0;
								if (formCount === 0 && deptCount === 0) return '全部';
								return `${formCount}表单 ${deptCount}部门`;
							}
						},
						{
							"key": "status",
							"title": "状态",
							"type": "tag",
							"width": colWidth,
							data: [
								{ value: "active", label: "启用", tagType: "success" },
								{ value: "inactive", label: "停用", tagType: "danger" }
							]
						},
						{
							"key": "update_date",
							"title": "更新时间",
							"type": "time",
							"width": colWidth
						}
					],
					multipleSelection: [],
					selectItem: ""
				},

				// 查询表单
				queryForm1: {
					formData: {
						code: "",
						name: "",
						status: ""
					},
					columns: [
						{
							"key": "code",
							"title": "规则编码",
							"type": "text",
							"width": colWidth,
							"mode": "%%"
						},
						{
							"key": "name",
							"title": "规则名称",
							"type": "text",
							"width": colWidth,
							"mode": "%%"
						},
						{
							"key": "status",
							"title": "状态",
							"type": "select",
							"width": colWidth,
							"mode": "=",
							"data": [
								{ value: "active", label: "启用" },
								{ value: "inactive", label: "停用" }
							]
						}
					]
				},

				form1: {
					data: {
						code: "",
						name: "",
						description: "",
						rule_expression: {
							type: "simple",
							conditions: [],
							logic: "and"
						},
						scope: {
							form_types: [],
							departments: []
						},
						status: "active"
					},
					props: {
						action: "",
						rules: {
							code: [
								{ required: true, message: "规则编码不能为空", trigger: ['blur', 'change'] },
								{ max: 50, message: "规则编码长度不能超过50个字符", trigger: ['blur', 'change'] },
								{ 
									pattern: /^[A-Z][A-Z0-9_]*$/,
									message: "规则编码只能包含大写字母、数字和下划线，且以字母开头",
									trigger: ['blur', 'change']
								}
							],
							name: [
								{ required: true, message: "规则名称不能为空", trigger: ['blur', 'change'] },
								{ max: 100, message: "规则名称长度不能超过100个字符", trigger: ['blur', 'change'] }
							],
							"rule_expression.conditions": [{
								validator: (rule, value, callback) => {
									if (!value || value.length === 0) {
										callback(new Error("至少需要配置一个条件"));
									} else {
										const incomplete = value.some(condition =>
											!condition.field || !condition.operator || 
											condition.value === undefined || condition.value === null || condition.value === ''
										);
										if (incomplete) {
											callback(new Error("请完善所有条件配置"));
										} else {
											callback();
										}
									}
								},
								trigger: ['blur', 'change']
							}],
							status: [
								{ required: true, message: "状态不能为空", trigger: ['blur', 'change'] }
							]
						},
						formType: "",
						title: "",
						show: false
					}
				}
			};
		},

		onLoad(options = {}) {
			vk = this.vk;
			this.options = options;
			this.init(options);
		},

		methods: {
			async init(options) {
				originalForms["form1"] = vk.pubfn.copyObject(this.form1);
				await this.loadFormTypes();
				await this.loadDepartments();
				// 默认添加一个条件
				this.addCondition();
			},

			// 加载表单类型数据
			async loadFormTypes() {
				try {
					const res = await this.vk.callFunction({
						url: 'admin/bpmn/form-type/sys/getList',
						data: {
							formData: { status: 'active' }
						}
					});

					if (res.code === 0) {
						this.formTypes = res.rows.map(item => ({
							value: item.code,
							label: item.name
						}));
					}
				} catch (error) {
					console.error('加载表单类型失败:', error);
					this.formTypes = [
						{ value: 'SEAL_APPLY', label: '用印申请' },
						{ value: 'LEAVE_APPLY', label: '请假申请' },
						{ value: 'EXPENSE_APPLY', label: '费用报销' }
					];
				}
			},

			// 加载部门数据
			async loadDepartments() {
				try {
					// 这里需要根据实际情况调用获取部门列表的接口
					this.departments = [
						{ value: 'tech', label: '技术部' },
						{ value: 'sales', label: '销售部' },
						{ value: 'marketing', label: '市场部' },
						{ value: 'hr', label: '人力资源部' },
						{ value: 'finance', label: '财务部' }
					];
				} catch (error) {
					console.error('加载部门数据失败:', error);
				}
			},

			// 条件规则相关方法
			addCondition() {
				this.form1.data.rule_expression.conditions.push({
					field: '',
					operator: 'eq',
					value: '',
					value_type: 'constant'
				});
			},

			addConditionGroup() {
				// 添加一个条件组（在复合规则中）
				this.form1.data.rule_expression.conditions.push({
					field: '',
					operator: 'eq',
					value: '',
					value_type: 'constant',
					_group: true
				});
			},

			removeCondition(index) {
				if (this.form1.data.rule_expression.conditions.length > 1) {
					this.form1.data.rule_expression.conditions.splice(index, 1);
				} else {
					this.$message.warning('至少需要保留一个条件');
				}
			},

			onFieldChange(condition) {
				// 根据字段类型设置默认操作符
				const fieldConfig = this.getFieldConfig(condition.field);
				if (fieldConfig) {
					const defaultOperator = this.getAvailableOperators(condition.field)[0];
					condition.operator = defaultOperator ? defaultOperator.value : 'eq';
					condition.value = '';
				}
			},

			onValueTypeChange(condition) {
				// 值类型改变时重置值
				condition.value = '';
			},

			onRuleTypeChange(type) {
				if (type === 'simple' && this.form1.data.rule_expression.conditions.length > 1) {
					this.$message.info('简单规则模式下，建议只使用一个条件');
				}
			},

			// 获取字段配置
			getFieldConfig(fieldValue) {
				for (const group of this.fieldGroups) {
					const field = group.options.find(f => f.value === fieldValue);
					if (field) return field;
				}
				return null;
			},

			// 获取可用操作符
			getAvailableOperators(fieldValue) {
				const fieldConfig = this.getFieldConfig(fieldValue);
				if (fieldConfig) {
					return this.operators[fieldConfig.type] || this.operators.string;
				}
				return this.operators.string;
			},

			// 获取值输入组件
			getValueComponent(condition) {
				const fieldConfig = this.getFieldConfig(condition.field);
				if (fieldConfig && fieldConfig.type === 'select') {
					return 'ValueInput';
				}
				return 'el-input';
			},

			// 是否为多选操作符
			isMultipleOperator(operator) {
				return ['in', 'not_in'].includes(operator);
			},

			// 获取字段选项
			getFieldOptions(fieldValue) {
				return this.fieldOptions[fieldValue] || [];
			},

			// 获取值占位符
			getValuePlaceholder(condition) {
				const fieldConfig = this.getFieldConfig(condition.field);
				if (!fieldConfig) return '输入值';

				switch (condition.value_type) {
					case 'variable':
						return '输入变量名，如：${applicant.department}';
					case 'expression':
						return '输入表达式，如：amount > 1000';
					default:
						if (fieldConfig.type === 'select') {
							return '选择值';
						}
						return '输入值';
				}
			},

			// 获取值类型描述
			getValueTypeDescription(valueType) {
				const descriptions = {
					constant: '固定值，直接参与条件比较',
					variable: '引用流程变量，运行时动态获取值',
					expression: 'JavaScript表达式，支持复杂逻辑计算'
				};
				return descriptions[valueType] || '';
			},

			// 格式化规则预览
			formatRulePreview() {
				const { conditions, type, logic } = this.form1.data.rule_expression;
				if (conditions.length === 0) return '暂无条件';

				const conditionTexts = conditions.map(condition => {
					const fieldConfig = this.getFieldConfig(condition.field);
					const fieldName = fieldConfig ? fieldConfig.label : condition.field;
					const operatorText = this.operators.string.find(op => op.value === condition.operator)?.label || condition.operator;
					
					return `${fieldName} ${operatorText} ${condition.value}`;
				});

				if (type === 'simple' || conditions.length === 1) {
					return conditionTexts[0];
				} else {
					const logicText = logic === 'and' ? ' 并且 ' : ' 或者 ';
					return conditionTexts.join(logicText);
				}
			},

			// 测试单个条件
			testCondition(condition) {
				this.$message.info(`测试条件: ${this.formatConditionText(condition)}`);
				// 这里可以调用后端接口测试条件
			},

			// 测试规则
			testRule(item) {
				this.$message.info(`测试规则: ${item.name}`);
				// 这里可以打开测试对话框
			},

			// 显示规则说明
			showRuleHelp() {
				this.ruleHelpVisible = true;
			},

			// 格式化条件文本
			formatConditionText(condition) {
				const fieldConfig = this.getFieldConfig(condition.field);
				const fieldName = fieldConfig ? fieldConfig.label : condition.field;
				const operatorText = this.operators.string.find(op => op.value === condition.operator)?.label || condition.operator;
				
				return `${fieldName} ${operatorText} ${condition.value}`;
			},

			// 表单重置
			resetForm() {
				this.form1.data = vk.pubfn.copyObject(originalForms["form1"].data);
				this.enableScope = true;
				// 默认添加一个条件
				this.addCondition();
				if (this.$refs.formRef) {
					this.$refs.formRef.clearValidate();
				}
			},

			// 搜索
			search() {
				this.$refs.table1.search();
			},

			// 刷新
			refresh() {
				this.$refs.table1.refresh();
			},

			// 获取当前选中的行的数据
			getCurrentRow() {
				return this.$refs.table1.getCurrentRow();
			},

			// 监听 - 行的选中高亮事件
			currentChange(val) {
				this.table1.selectItem = val;
			},

			// 当选择项发生变化时会触发该事件
			selectionChange(list) {
				this.table1.multipleSelection = list;
			},

			// 显示添加页面
			addBtn() {
				this.resetForm();
				this.form1.props.action = 'admin/bpmn/condition-rule/sys/add';
				this.form1.props.formType = 'add';
				this.form1.props.title = '添加条件规则';
				this.form1.props.show = true;
			},

			// 显示修改页面
			updateBtn({ item }) {
				this.form1.props.action = 'admin/bpmn/condition-rule/sys/update';
				this.form1.props.formType = 'update';
				this.form1.props.title = '编辑条件规则';
				this.form1.props.show = true;

				// 深拷贝数据
				this.form1.data = vk.pubfn.copyObject(item);

				// 确保数据结构完整
				if (!this.form1.data.rule_expression) {
					this.form1.data.rule_expression = {
						type: "simple",
						conditions: [],
						logic: "and"
					};
				}
				if (!this.form1.data.scope) {
					this.form1.data.scope = {
						form_types: [],
						departments: []
					};
				}

				// 设置适用范围开关
				this.enableScope = this.form1.data.scope.form_types.length > 0 || 
								  this.form1.data.scope.departments.length > 0;
			},

			// 显示详情
			showDetail(item) {
				this.$message.info(`查看规则详情: ${item.name}`);
			},

			// 删除按钮
			deleteBtn({ item }) {
				this.$confirm('确定删除该条件规则吗？', '提示', {
					type: 'warning'
				}).then(async () => {
					try {
						const res = await this.vk.callFunction({
							url: 'admin/bpmn/condition-rule/sys/delete',
							data: { _id: item._id }
						});

						if (res.code === 0) {
							this.$message.success('删除成功');
							this.refresh();
						} else {
							this.$message.error(res.msg || '删除失败');
						}
					} catch (error) {
						console.error('删除失败:', error);
						this.$message.error('删除失败');
					}
				}).catch(() => {
					// 用户取消
				});
			},

			// 提交表单
			async submitForm() {
				if (!this.$refs.formRef) return;

				try {
					await this.$refs.formRef.validate();
					
					// 处理适用范围
					if (!this.enableScope) {
						this.form1.data.scope.form_types = [];
						this.form1.data.scope.departments = [];
					}

					this.formLoading = true;

					const res = await this.vk.callFunction({
						url: this.form1.props.action,
						data: {
							...this.form1.data,
							_id: this.form1.data._id
						}
					});

					if (res.code === 0) {
						this.$message.success(this.form1.props.formType === 'add' ? '添加成功' : '更新成功');
						this.form1.props.show = false;
						this.refresh();
					} else {
						this.$message.error(res.msg || '操作失败');
					}
				} catch (error) {
					console.error('表单验证失败:', error);
				} finally {
					this.formLoading = false;
				}
			},

			// 保存并测试
			async saveAndTest() {
				await this.submitForm();
				// 保存成功后进行测试
				if (!this.form1.props.show) {
					this.testRule(this.form1.data);
				}
			}
		}
	};
</script>

<style lang="scss" scoped>
	.page-body {
		padding: 20rpx;
		background: #f5f7fa;
		min-height: 100vh;
	}

	.button-group {
		margin-bottom: 20rpx;
		padding: 20rpx 24rpx;
		background: #fff;
		border-radius: 8rpx;
		box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.05);
		border: 1rpx solid #ebeef5;
	}

	// 弹窗样式
	::v-deep .condition-rule-dialog {
		.el-dialog__body {
			padding: 0;
		}
	}

	.dialog-content {
		padding: 24px;
		max-height: 70vh;
		overflow-y: auto;
	}

	.condition-form {
		.form-section {
			margin-bottom: 24px;
			border-radius: 8px;
			border: 1px solid #e4e7ed;

			&:last-child {
				margin-bottom: 0;
			}

			::v-deep .el-card__header {
				padding: 16px 20px;
				background: #f8f9fa;
				border-bottom: 1px solid #e4e7ed;
			}
		}

		.section-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.section-title {
			font-size: 16px;
			font-weight: 600;
			color: #303133;
		}

		.section-actions {
			display: flex;
			align-items: center;
		}

		.form-tip {
			font-size: 12px;
			color: #909399;
			margin-top: 4px;
			line-height: 1.4;
		}

		.no-margin-form-item {
			margin-bottom: 0;

			::v-deep .el-form-item__content {
				margin-left: 0 !important;
			}
		}

		.inline-form-item {
			margin-bottom: 0;

			::v-deep .el-form-item__content {
				line-height: normal;
			}
		}
	}

	// 规则预览
	.rule-preview {
		margin-bottom: 16px;
		padding: 12px 16px;
		background: #f0f9ff;
		border: 1px solid #bee3f8;
		border-radius: 6px;

		.preview-title {
			font-weight: 600;
			color: #2b6cb0;
			margin-bottom: 4px;
		}

		.preview-content {
			color: #2d3748;
			font-family: 'Courier New', monospace;
			background: #fff;
			padding: 8px 12px;
			border-radius: 4px;
			border: 1px solid #e2e8f0;
		}
	}

	// 条件配置样式
	.conditions-container {
		padding: 0;
	}

	.condition-list {
		margin-bottom: 16px;
	}

	.condition-item {
		margin-bottom: 20px;

		&:last-child {
			margin-bottom: 0;
		}
	}

	.condition-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		padding: 0 4px;

		.condition-index {
			font-size: 14px;
			font-weight: 600;
			color: #409eff;
		}
	}

	.condition-content {
		padding: 16px;
		background: #f8f9fa;
		border-radius: 6px;
		border: 1px solid #e4e7ed;
	}

	.condition-row {
		display: flex;
		align-items: flex-start;
	}

	.condition-actions {
		display: flex;
		justify-content: center;
		padding-top: 4px;
	}

	.value-type-tip {
		margin-top: 8px;
		font-size: 12px;
		color: #909399;
		padding: 4px 8px;
		background: #edf2f7;
		border-radius: 4px;
	}

	.condition-connector {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 12px 0;
		padding: 0 20px;
	}

	.connector-line {
		flex: 1;
		height: 2px;
		background: #dcdfe6;
	}

	.connector-text {
		padding: 0 16px;
	}

	.condition-actions-bottom {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin-top: 16px;
	}

	.add-condition-btn {
		border: 1px dashed #dcdfe6;
		background: #fff;
		color: #606266;

		&:hover {
			border-color: #409eff;
			color: #409eff;
		}
	}

	// 字段选项样式
	.field-option {
		.field-name {
			font-size: 14px;
			color: #303133;
		}

		.field-desc {
			font-size: 12px;
			color: #909399;
			margin-top: 2px;
		}
	}

	// 选项样式
	.option-item {
		.option-name {
			font-size: 14px;
			color: #303133;
		}

		.option-code {
			font-size: 12px;
			color: #909399;
			margin-top: 2px;
		}
	}

	// 适用范围禁用提示
	.scope-disabled-tip {
		padding: 12px 0;
	}

	// 对话框底部
	.dialog-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 16px 24px;
		border-top: 1px solid #e4e7ed;
		background: #fafafa;
	}

	// 规则帮助内容
	.rule-help-content {
		h3, h4 {
			color: #303133;
			margin-bottom: 12px;
		}

		ul {
			padding-left: 20px;
			margin-bottom: 16px;

			li {
				margin-bottom: 8px;
				line-height: 1.5;
			}
		}
	}

	// 表格样式优化
	::v-deep .vk-data-table {
		.el-table {
			border-radius: 8px;
			overflow: hidden;
			box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.05);
		}

		.el-table__header {
			th {
				background-color: #f5f7fa;
				color: #606266;
				font-weight: 600;
			}
		}
	}

	// 响应式调整
	@media (max-width: 768px) {
		.dialog-content {
			padding: 16px;
		}

		.condition-form {
			.form-section {
				margin-bottom: 16px;
			}
		}

		.condition-content {
			padding: 12px;
		}

		.condition-row {
			flex-wrap: wrap;
		}

		.condition-row .el-col {
			margin-bottom: 8px;
		}
	}
</style>