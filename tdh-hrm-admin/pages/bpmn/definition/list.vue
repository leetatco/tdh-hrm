<template>
	<view class="page-body">
		<!-- 页面内容开始 -->

		<!-- 表格搜索组件开始 -->
		<vk-data-table-query v-model="queryForm1.formData" :columns="queryForm1.columns"
			@search="search"></vk-data-table-query>
		<!-- 表格搜索组件结束 -->

		<!-- 自定义按钮区域开始 -->
		<view class="action-bar">
			<el-row>
				<el-button type="success" size="small" icon="el-icon-circle-plus-outline" @click="addBtn"
					v-if="$hasRole('admin') || $hasPermission('bpmn-workflow-add')">添加流程</el-button>
				<el-button type="warning" size="small" icon="el-icon-video-play" @click="publishBtn"
					v-if="$hasRole('admin') || $hasPermission('bpmn-workflow-add')" :disabled="!table1.selectItem">发布</el-button>
				<el-button type="info" size="small" icon="el-icon-switch-button" @click="disableBtn"
					v-if="$hasRole('admin') || $hasPermission('bpmn-workflow-add')" :disabled="!table1.selectItem">停用</el-button>
				<!-- 批量操作 -->
				<el-dropdown v-if="table1.multipleSelection && ($hasRole('admin') || $hasPermission('bpmn-workflow-add'))"
					:split-button="false" trigger="click" @command="batchBtn">
					<el-button type="danger" size="small" style="margin-left: 20rpx;"
						:disabled="table1.multipleSelection.length === 0">
						批量操作<i class="el-icon-arrow-down el-icon--right"></i>
					</el-button>
					<el-dropdown-menu slot="dropdown">
						<el-dropdown-item :command="1">批量发布</el-dropdown-item>
						<el-dropdown-item :command="2">批量停用</el-dropdown-item>
					</el-dropdown-menu>
				</el-dropdown>
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
			:close-on-click-modal="false" custom-class="process-definition-dialog">
			<vk-data-form v-model="form1.data" :rules="form1.props.rules" :action="form1.props.action"
				:form-type="form1.props.formType" :columns='form1.props.columns' label-width="140px"
				@success="form1.props.show = false;refresh();">
				<!-- 基础信息区域 -->
				<template #before>
					<view class="form-section">
						<view class="section-header">
							<text class="section-title">基础信息</text>
							<text class="section-desc">填写流程的基本信息和分类</text>
						</view>
					</view>
				</template>

				<!-- 节点设计器自定义插槽 -->
				<template #nodes="props">
					<view class="form-section">
						<view class="section-header">
							<text class="section-title">流程节点设计</text>
							<text class="section-desc">设计流程的节点和流转路径</text>
						</view>

						<view class="node-designer">
							<view class="designer-toolbar">
								<el-button type="primary" size="small" icon="el-icon-plus"
									@click="addNode">添加节点</el-button>
								<el-button type="success" size="small" icon="el-icon-s-operation"
									@click="validateNodeDesign">验证设计</el-button>
								<el-button type="info" size="small" icon="el-icon-question"
									@click="showDesignHelp">设计帮助</el-button>
							</view>

							<!-- 节点统计 -->
							<view class="node-stats" v-if="form1.data.nodes && form1.data.nodes.length > 0">
								<view class="stat-item">
									<text class="stat-label">节点总数:</text>
									<text class="stat-value">{{ form1.data.nodes.length }}</text>
								</view>
								<view class="stat-item">
									<text class="stat-label">开始节点:</text>
									<text class="stat-value">{{ startNodeCount }}</text>
								</view>
								<view class="stat-item">
									<text class="stat-label">结束节点:</text>
									<text class="stat-value">{{ endNodeCount }}</text>
								</view>
								<view class="stat-item">
									<text class="stat-label">任务节点:</text>
									<text class="stat-value">{{ taskNodeCount }}</text>
								</view>
							</view>

							<view class="nodes-container">
								<!-- 空状态 -->
								<view v-if="!form1.data.nodes || form1.data.nodes.length === 0" class="empty-nodes">
									<image src="/static/images/empty-process.png" class="empty-image" mode="aspectFit">
									</image>
									<text class="empty-title">暂无流程节点</text>
									<text class="empty-desc">点击"添加节点"开始设计您的业务流程</text>
								</view>

								<!-- 节点列表 -->
								<view v-for="(node, index) in form1.data.nodes" :key="index" class="node-item"
									:class="`node-${node.node_type}`">
									<view class="node-header">
										<view class="node-badge">
											<text class="node-index">{{ index + 1 }}</text>
										</view>
										<view class="node-info">
											<text class="node-name">{{ node.node_name }}</text>
											<text class="node-key">{{ node.node_key }}</text>
										</view>
										<view class="node-type-tag">
											<text>{{ getNodeTypeText(node.node_type) }}</text>
										</view>
									</view>

									<view class="node-content">
										<!-- 负责人信息 -->
										<view v-if="node.assignee_type" class="node-field">
											<text class="field-label">负责人:</text>
											<text class="field-value">{{ getAssigneeText(node) }}</text>
										</view>

										<!-- 审批设置 -->
										<view v-if="node.required_approvals" class="node-field">
											<text class="field-label">需要同意:</text>
											<text class="field-value">{{ node.required_approvals }}人</text>
										</view>

										<!-- 时间限制 -->
										<view v-if="node.time_limit" class="node-field">
											<text class="field-label">时间限制:</text>
											<text class="field-value">{{ node.time_limit }}小时</text>
										</view>

										<!-- 可用操作 -->
										<view v-if="node.actions && node.actions.length > 0" class="node-field">
											<text class="field-label">可用操作:</text>
											<view class="actions-tags">
												<text v-for="(action, i) in node.actions" :key="i" class="action-tag">
													{{ getActionText(action) }}
												</text>
											</view>
										</view>

										<!-- 下一节点连接 -->
										<view v-if="node.next_nodes && node.next_nodes.length > 0" class="next-nodes">
											<text class="next-label">下一节点:</text>
											<view class="next-nodes-list">
												<text v-for="(nextNode, i) in node.next_nodes" :key="i"
													class="next-node-item">
													{{ getNodeName(nextNode.node_key) }}
													<span v-if="nextNode.condition_rule_code"
														class="condition-tag">条件</span>
													<span v-if="nextNode.default_path" class="default-tag">默认</span>
												</text>
											</view>
										</view>
									</view>

									<view class="node-actions">
										<el-button size="mini" icon="el-icon-edit"
											@click="editNode(index)">编辑</el-button>
										<el-button size="mini" icon="el-icon-connection" type="primary"
											@click="editNodeConnections(index)">连接</el-button>
										<el-button size="mini" icon="el-icon-delete" type="danger"
											@click="removeNode(index)">删除</el-button>
									</view>
								</view>
							</view>

							<!-- 设计提示 -->
							<view class="design-tips" v-if="form1.data.nodes && form1.data.nodes.length > 0">
								<view class="tips-header">
									<text class="tips-title">设计提示</text>
								</view>
								<ul class="tips-list">
									<li>每个流程必须包含且只能包含一个开始节点</li>
									<li>流程必须包含至少一个结束节点</li>
									<li>点击"连接"按钮配置节点之间的流转关系</li>
									<li>可以为节点设置条件分支实现复杂流程</li>
								</ul>
							</view>
						</view>
					</view>
				</template>
			</vk-data-form>
		</vk-data-dialog>
		<!-- 添加或编辑的弹窗结束 -->

		<!-- 节点编辑弹窗开始 -->
		<vk-data-dialog v-model="nodeDialog.show" :title="nodeDialog.title" width="800px" :close-on-click-modal="false">
			<view class="node-form-dialog">
				<view class="form-tabs">
					<el-tabs v-model="nodeDialog.activeTab">
						<el-tab-pane label="基本信息" name="basic">
							<vk-data-form v-model="nodeDialog.data" :rules="nodeDialog.rules"
								:columns="nodeDialog.basicColumns" label-width="140px" :footer-show="false">
							</vk-data-form>
						</el-tab-pane>
						<el-tab-pane label="高级设置" name="advanced">
							<vk-data-form v-model="nodeDialog.data" :rules="nodeDialog.rules"
								:columns="nodeDialog.advancedColumns" label-width="140px" :footer-show="false">
							</vk-data-form>
						</el-tab-pane>
					</el-tabs>
				</view>
			</view>

			<template v-slot:footer="{ close }">
				<el-button @click="close">取 消</el-button>
				<el-button type="primary" @click="saveNode">确 定</el-button>
			</template>
		</vk-data-dialog>
		<!-- 节点编辑弹窗结束 -->

		<!-- 节点连接配置弹窗开始 -->
		<vk-data-dialog v-model="connectionDialog.show" :title="connectionDialog.title" width="900px"
			:close-on-click-modal="false">
			<view class="connection-dialog">
				<view class="current-node-info">
					<view class="current-node-card">
						<text class="card-label">当前节点</text>
						<text class="node-name">{{ connectionDialog.currentNode.node_name }}</text>
						<text class="node-key">{{ connectionDialog.currentNode.node_key }}</text>
						<text class="node-type">{{ getNodeTypeText(connectionDialog.currentNode.node_type) }}</text>
					</view>
				</view>

				<view class="connections-section">
					<view class="section-header">
						<text class="section-title">流转路径配置</text>
						<el-button type="primary" size="small" @click="addConnection" icon="el-icon-plus">
							添加路径
						</el-button>
					</view>

					<view class="connections-list">
						<view v-if="connectionDialog.connections.length === 0" class="empty-connections">
							<text class="empty-text">暂无流转路径，点击"添加路径"进行配置</text>
						</view>

						<view v-for="(connection, index) in connectionDialog.connections" :key="index"
							class="connection-item">
							<view class="connection-header">
								<text class="connection-title">路径 {{ index + 1 }}</text>
								<el-button size="mini" type="danger" icon="el-icon-delete" plain
									@click="removeConnection(index)">
									删除
								</el-button>
							</view>
							<view class="connection-form">
								<view class="form-row">
									<view class="form-field">
										<text class="field-label">下一节点</text>
										<el-select v-model="connection.node_key" placeholder="请选择下一节点" size="small">
											<el-option v-for="node in availableNextNodes" :key="node.node_key"
												:label="`${node.node_name} (${node.node_key})`" :value="node.node_key">
											</el-option>
										</el-select>
									</view>

									<view class="form-field">
										<text class="field-label">条件规则</text>
										<el-select v-model="connection.condition_rule_code" placeholder="选择条件规则(可选)"
											size="small">
											<el-option label="无条件" value=""></el-option>
											<el-option v-for="rule in conditionRules" :key="rule.code"
												:label="rule.name" :value="rule.code">
											</el-option>
										</el-select>
									</view>
								</view>

								<view class="form-row">
									<el-checkbox v-model="connection.default_path">
										设为默认路径（当没有条件匹配时使用此路径）
									</el-checkbox>
								</view>
							</view>
						</view>
					</view>
				</view>

				<view class="connection-guide">
					<view class="guide-header">
						<text class="guide-title">配置说明</text>
					</view>
					<view class="guide-content">
						<view class="guide-item">
							<text class="guide-icon">💡</text>
							<text class="guide-text">可以为节点配置多个流转路径实现条件分支</text>
						</view>
						<view class="guide-item">
							<text class="guide-icon">⚠️</text>
							<text class="guide-text">结束节点不能有下一节点</text>
						</view>
						<view class="guide-item">
							<text class="guide-icon">✅</text>
							<text class="guide-text">建议为每个分支设置一个默认路径</text>
						</view>
					</view>
				</view>
			</view>

			<template v-slot:footer="{ close }">
				<el-button @click="close">取 消</el-button>
				<el-button type="primary" @click="saveConnections">保 存</el-button>
			</template>
		</vk-data-dialog>
		<!-- 节点连接配置弹窗结束 -->

		<!-- 页面内容结束 -->
	</view>
</template>

<script>
	let vk = uni.vk; // vk实例
	let originalForms = {}; // 表单初始化数据
	const colWidth = 200;

	export default {
		data() {
			return {
				// 页面是否请求中或加载中
				loading: false,
				// init请求返回的数据
				data: {},
				// 节点连接配置弹窗
				connectionDialog: {
					show: false,
					title: '配置节点连接',
					currentNode: {},
					currentNodeIndex: -1,
					connections: []
				},
				// 条件规则列表
				conditionRules: [],
				// 节点编辑弹窗
				nodeDialog: {
					show: false,
					title: '添加节点',
					data: {},
					editingIndex: -1,
					activeTab: 'basic',
					rules: {
						node_key: [{
							required: true,
							message: '请输入节点KEY',
							trigger: ['blur', 'change']
						}],
						node_name: [{
							required: true,
							message: '请输入节点名称',
							trigger: ['blur', 'change']
						}],
						node_type: [{
							required: true,
							message: '请选择节点类型',
							trigger: ['blur', 'change']
						}]
					},
					basicColumns: [{
							key: "node_key",
							title: "节点KEY",
							type: "text",
							placeholder: "节点的唯一标识，如：start、approve_1",
							tip: "节点KEY在流程内必须唯一，建议使用英文和数字"
						},
						{
							key: "node_name",
							title: "节点名称",
							type: "text",
							placeholder: "如：开始节点、部门审批",
							tip: "节点显示名称，便于识别"
						},
						{
							key: "node_type",
							title: "节点类型",
							type: "radio",
							data: [{
									value: "start",
									label: "开始节点"
								},
								{
									value: "end",
									label: "结束节点"
								},
								{
									value: "userTask",
									label: "用户任务"
								},
								{
									value: "approval",
									label: "审批节点"
								},
								{
									value: "review",
									label: "通知节点"
								},
								{
									value: "gateway",
									label: "网关节点"
								}
							],
							tip: "开始节点和结束节点是必须的，审批节点支持多人审批"
						},
						{
							key: "description",
							title: "节点描述",
							type: "textarea",
							placeholder: "请输入节点的详细描述",
							tip: "描述节点的具体功能和注意事项"
						}
					],
					advancedColumns: [{
							key: "assignee_type",
							title: "负责人类型",
							type: "select",
							data: [{
									value: "user",
									label: "指定用户"
								},
								{
									value: "role",
									label: "按角色"
								},
								{
									value: "department",
									label: "按部门"
								},
								{
									value: "variable",
									label: "表单变量"
								},
								{
									value: "previous",
									label: "上一处理人"
								}
							],
							tip: "选择任务的负责人指定方式"
						},
						{
							key: "assignee_value",
							title: "负责人值",
							type: "text",
							placeholder: "根据负责人类型填写：用户ID、角色编码、部门编码、表单字段名等",
							tip: "根据选择的负责人类型填写对应的值"
						},
						{
							key: "required_approvals",
							title: "需要同意数",
							type: "number",
							defaultValue: 1,
							min: 1,
							tip: "需要多少人同意才能进入下一节点（适用于审批节点）"
						},
						{
							key: "time_limit",
							title: "时间限制(小时)",
							type: "number",
							placeholder: "任务处理时间限制，0表示无限制",
							tip: "设置任务处理的时间限制，超时会自动提醒"
						},
						{
							key: "actions",
							title: "可用操作",
							type: "checkbox",
							data: [{
									value: "submit",
									label: "提交"
								},
								{
									value: "approve",
									label: "同意"
								},
								{
									value: "reject",
									label: "拒绝"
								},
								{
									value: "return",
									label: "退回"
								},
								{
									value: "transfer",
									label: "转办"
								},
								// {
								// 	value: "delegate",
								// 	label: "委托"
								// }
							],
							defaultValue: ["approve", "reject"],
							tip: "选择在该节点可执行的操作"
						},
						{
							key: "form_schema",
							title: "节点表单",
							type: "textarea",
							placeholder: "可配置节点专用的表单结构(JSON格式)",
							tip: "自定义该节点专用的表单字段和布局"
						}
					]
				},
				// 表格相关开始 -----------------------------------------------------------
				table1: {
					// 表格数据请求地址
					action: "admin/bpmn/definition/sys/getList",
					//按钮显示
					rightBtns: [{
							mode: 'detail_auto',
							title: '详细',
							show: (item) => {
								return this.$hasRole('admin') || this.$hasPermission('bpmn-workflow-view')
							}
						},
						{
							mode: 'update',
							title: '编辑',
							show: (item) => {
								return this.$hasRole('admin') || this.$hasPermission('bpmn-workflow-edit')
							}
						},
						{
							mode: 'delete',
							title: '删除',
							show: (item) => {
								return this.$hasRole('admin') || this.$hasPermission('bpmn-workflow-delete')
							}
						}
					],
					// 表格字段显示规则
					columns: [{
							key: "name",
							title: "流程名称",
							type: "text",
							width: colWidth
						},
						{
							key: "key",
							title: "流程KEY",
							type: "text",
							width: colWidth
						},
						{
							key: "nodes",
							title: "节点数量",
							type: "text",
							width: colWidth,
							formatter: (value) => {
								return value && value.length ? `${value.length}个` : '0个';
							}
						},
						{
							key: "category_name",
							title: "流程分类",
							type: "text",
							width: colWidth,
							formatter: function(val, row, column, index) {
								return row.category_name =
									`${row.categorys11[0].categorys1[0].category_name}/${row.categorys11[0].category_name}`;
							}
						},
						{
							key: "status",
							title: "状态",
							type: "tag",
							width: colWidth,
							data: [{
									value: "draft",
									label: "草稿",
									type: "info"
								},
								{
									value: "active",
									label: "已发布",
									type: "success"
								},
								{
									value: "inactive",
									label: "已停用",
									type: "danger"
								}
							]
						},
						{
							key: "tags",
							title: "标签",
							type: "tags",
							width: colWidth
						},
						{
							key: "version",
							title: "版本",
							type: "number",
							width: colWidth,
							show: ["detail"]
						},
						{
							key: "_add_time",
							title: "创建时间",
							type: "time",
							width: colWidth
						}
					],
					// 多选框选中的值
					multipleSelection: [],
					// 当前高亮的记录
					selectItem: ""
				},
				// 表格相关结束 -----------------------------------------------------------
				// 表单相关开始 -----------------------------------------------------------
				// 查询表单请求数据
				queryForm1: {
					// 查询表单数据源，可在此设置默认值
					formData: {},
					// 查询表单的字段规则 fieldName:指定数据库字段名,不填默认等于key
					columns: [{
							key: "name",
							title: "流程名称",
							type: "text",
							mode: "%%"
						},
						{
							key: "key",
							title: "流程KEY",
							type: "text",
							mode: "%%"
						},

						{
							key: "category_id",
							title: "流程分类",
							type: "cascader",
							placeholder: "请选择流程分类",
							action: "admin/bpmn/category/sys/getList",
							props: {
								list: "rows",
								value: "category_id",
								label: "category_name",
								checkStrictly: true,
								emitPath: false
							},
							showAll: true,
							"mode": "="
						},
						{
							key: "status",
							title: "状态",
							type: "select",
							mode: "=",
							data: [{
									value: "draft",
									label: "草稿"
								},
								{
									value: "active",
									label: "已发布"
								},
								{
									value: "inactive",
									label: "已停用"
								}
							]
						}
					]
				},
				form1: {
					// 表单请求数据，此处可以设置默认值
					data: {
						status: "draft",
						version: 1,
						nodes: []
					},
					// 表单属性
					props: {
						// 表单请求地址
						action: "",
						// 表单字段显示规则
						columns: [{
								key: "name",
								title: "流程名称",
								type: "text",
								rules: [{
									required: true,
									message: "请输入流程名称"
								}],
								tip: "流程的显示名称，便于识别和管理"
							},
							{
								key: "key",
								title: "流程KEY",
								type: "text",
								rules: [{
									required: true,
									message: "请输入流程KEY"
								}],
								tip: "流程的唯一标识，建议使用英文，如：leave_approval"
							},
							{
								key: "category_id",
								title: "流程分类",
								type: "tree-select",
								action: "admin/bpmn/category/sys/getList",
								props: {
									list: "rows",
									value: "category_id",
									label: "category_name",
									children: "children"
								},
								tip: "选择流程所属的业务分类，便于管理"
							},
							{
								key: "version",
								title: "版本号",
								type: "number",
								disabled: true,
								tip: "系统自动生成的版本号，每次发布新版本会自动递增"
							},
							{
								key: "description",
								title: "流程描述",
								type: "textarea",
								tip: "详细描述流程的用途和业务场景"
							},
							{
								key: "nodes",
								title: "流程节点",
								type: "custom",
								rules: [{
									validator: this.validateNodes,
									message: "请至少配置开始和结束节点",
									trigger: ['blur', 'change']
								}]
							},
							{
								key: "status",
								title: "状态",
								type: "radio",
								data: [{
										value: "draft",
										label: "草稿"
									},
									{
										value: "active",
										label: "已发布"
									},
									{
										value: "inactive",
										label: "已停用"
									}
								],
								tip: "草稿状态可用于测试，发布后流程才能正式使用"
							},
							{
								key: "tags",
								title: "标签",
								type: "select",
								multiple: true,
								data: [{
										value: "重要",
										label: "重要"
									},
									{
										value: "日常",
										label: "日常"
									},
									{
										value: "紧急",
										label: "紧急"
									},
									{
										value: "财务",
										label: "财务"
									},
									{
										value: "人事",
										label: "人事"
									},
									{
										value: "行政",
										label: "行政"
									}
								],
								tip: "为流程添加标签，便于筛选和查找"
							}
						],
						// 表单验证规则
						rules: {
							name: [{
								required: true,
								message: "流程名称不能为空",
								trigger: ['blur', 'change']
							}],
							key: [{
								required: true,
								message: "流程KEY不能为空",
								trigger: ['blur', 'change']
							}],
							category_id: [{
								required: true,
								message: "流程分类不能为空",
								trigger: ['blur', 'change']
							}]
						},
						// add 代表添加 update 代表修改
						formType: "",
						// 弹窗标题
						title: "",
						// 是否显示表单的弹窗
						show: false
					}
				}
			};
		},
		// 监听 - 页面每次【加载时】执行(如：前进)
		onLoad(options = {}) {
			vk = this.vk;
			this.options = options;
			this.init(options);
		},
		// 计算属性
		computed: {
			// 可用的下一节点列表（排除当前节点和结束节点）
			availableNextNodes() {
				if (!this.form1.data.nodes) return [];
				return this.form1.data.nodes.filter(node =>
					node.node_key !== this.connectionDialog.currentNode.node_key &&
					node.node_type !== 'start'
				);
			},
			// 开始节点数量
			startNodeCount() {
				if (!this.form1.data.nodes) return 0;
				return this.form1.data.nodes.filter(node => node.node_type === 'start').length;
			},
			// 结束节点数量
			endNodeCount() {
				if (!this.form1.data.nodes) return 0;
				return this.form1.data.nodes.filter(node => node.node_type === 'end').length;
			},
			// 任务节点数量
			taskNodeCount() {
				if (!this.form1.data.nodes) return 0;
				const taskTypes = ['userTask', 'approval', 'review'];
				return this.form1.data.nodes.filter(node => taskTypes.includes(node.node_type)).length;
			}
		},
		methods: {
			// 页面数据初始化函数
			async init(options) {
				originalForms["form1"] = vk.pubfn.copyObject(this.form1);
				// 加载条件规则
				await this.loadConditionRules();
			},
			// 加载条件规则
			async loadConditionRules() {
				try {
					let res = await vk.callFunction({
						url: 'admin/bpmn/condition-rule/sys/getList',
						title: '请求中...',
						data: {},
					});

					if (res.code === 0) {
						this.conditionRules = res.rows;
					}
				} catch (err) {
					console.error('加载条件规则失败:', err);
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
				this.form1.props.action = 'admin/bpmn/definition/sys/add';
				this.form1.props.formType = 'add';
				this.form1.props.title = '添加流程定义';
				this.form1.props.show = true;

				// 确保nodes数组存在且是响应式的
				if (!this.form1.data.nodes) {
					this.form1.data.nodes = [];
				}
			},
			// 表单重置
			resetForm() {
				vk.pubfn.resetForm(originalForms, this);
			},
			// 显示修改页面
			updateBtn({
				item
			}) {
				this.form1.props.action = 'admin/bpmn/definition/sys/update';
				this.form1.props.formType = 'update';
				this.form1.props.title = '编辑流程定义';
				this.form1.props.show = true;

				// 使用Vue.set确保响应式
				this.$set(this.form1, 'data', vk.pubfn.copyObject(item));

				// 确保nodes数组存在
				if (!this.form1.data.nodes) {
					this.$set(this.form1.data, 'nodes', []);
				}
			},
			// 删除按钮
			deleteBtn({
				item,
				deleteFn
			}) {
				deleteFn({
					action: "admin/bpmn/definition/sys/delete",
					data: {
						_id: item._id
					},
				});
			},
			// 发布流程
			async publishBtn() {
				if (!this.table1.selectItem) {
					vk.toast("请选择要发布的流程");
					return;
				}

				try {
					await vk.callFunction({
						url: 'admin/bpmn/definition/sys/update',
						title: '发布中...',
						data: {
							_id: this.table1.selectItem._id,
							status: 'active'
						}
					});
					vk.toast("发布成功");
					this.refresh();
				} catch (err) {
					vk.toast("发布失败");
				}
			},
			// 停用流程
			async disableBtn() {
				if (!this.table1.selectItem) {
					vk.toast("请选择要停用的流程");
					return;
				}

				try {
					await vk.callFunction({
						url: 'admin/bpmn/definition/sys/update',
						title: '停用中...',
						data: {
							_id: this.table1.selectItem._id,
							status: 'inactive'
						}
					});
					vk.toast("停用成功");
					this.refresh();
				} catch (err) {
					vk.toast("停用失败");
				}
			},
			// 监听 - 批量操作的按钮点击事件
			async batchBtn(command) {
				if (this.table1.multipleSelection.length === 0) {
					vk.toast("请选择要操作的流程");
					return;
				}

				const ids = this.table1.multipleSelection.map(item => item._id);
				let status = '';

				switch (command) {
					case 1:
						status = 'active';
						break;
					case 2:
						status = 'inactive';
						break;
					default:
						return;
				}

				try {
					await vk.callFunction({
						url: 'admin/bpmn/definition/sys/update',
						title: '批量操作中...',
						data: {
							ids,
							status
						}
					});
					vk.toast("操作成功");
					this.refresh();
				} catch (err) {
					vk.toast("操作失败");
				}
			},
			// 节点相关方法
			addNode() {
				this.nodeDialog.data = {
					node_key: '',
					node_name: '',
					node_type: 'userTask',
					description: '',
					assignee_type: 'user',
					assignee_value: '',
					required_approvals: 1,
					time_limit: 0,
					actions: ['approve', 'reject'],
					form_schema: '',
					next_nodes: []
				};
				this.nodeDialog.title = '添加节点';
				this.nodeDialog.editingIndex = -1;
				this.nodeDialog.activeTab = 'basic';
				this.nodeDialog.show = true;
			},
			editNode(index) {
				this.nodeDialog.data = vk.pubfn.copyObject(this.form1.data.nodes[index]);
				this.nodeDialog.title = '编辑节点';
				this.nodeDialog.editingIndex = index;
				this.nodeDialog.activeTab = 'basic';
				this.nodeDialog.show = true;
			},
			// 编辑节点连接
			editNodeConnections(index) {
				const node = this.form1.data.nodes[index];
				this.connectionDialog.currentNode = node;
				this.connectionDialog.currentNodeIndex = index;
				this.connectionDialog.title = `配置节点连接 - ${node.node_name}`;
				this.connectionDialog.connections = node.next_nodes ? vk.pubfn.copyObject(node.next_nodes) : [];
				this.connectionDialog.show = true;
			},
			removeNode(index) {
				this.$confirm('确定要删除这个节点吗？删除后该节点的所有连接关系也会被清除。', '提示', {
					type: 'warning'
				}).then(() => {
					this.form1.data.nodes.splice(index, 1);
					this.$forceUpdate();
					vk.toast("节点删除成功");
				}).catch(() => {});
			},
			saveNode() {
				if (!this.form1.data.nodes) {
					this.$set(this.form1.data, 'nodes', []);
				}

				if (!this.nodeDialog.data.node_key) {
					vk.toast("请输入节点KEY");
					return;
				}
				if (!this.nodeDialog.data.node_name) {
					vk.toast("请输入节点名称");
					return;
				}

				// 检查节点KEY是否重复
				if (this.nodeDialog.editingIndex === -1) {
					const exists = this.form1.data.nodes.some(
						node => node.node_key === this.nodeDialog.data.node_key
					);
					if (exists) {
						vk.toast("节点KEY已存在，请重新输入");
						return;
					}
				}

				const nodeData = vk.pubfn.copyObject(this.nodeDialog.data);

				if (this.nodeDialog.editingIndex === -1) {
					this.form1.data.nodes.push(nodeData);
				} else {
					this.$set(this.form1.data.nodes, this.nodeDialog.editingIndex, nodeData);
				}

				this.nodeDialog.show = false;
				vk.toast("保存成功");
			},
			// 节点连接相关方法
			addConnection() {
				this.connectionDialog.connections.push({
					node_key: '',
					condition_rule_code: '',
					default_path: false
				});
			},
			removeConnection(index) {
				this.connectionDialog.connections.splice(index, 1);
			},
			saveConnections() {
				const connections = this.connectionDialog.connections;
				const hasEmptyNodeKey = connections.some(conn => !conn.node_key);

				if (hasEmptyNodeKey) {
					vk.toast("请为所有连接选择下一节点");
					return;
				}

				const allNodeKeys = this.form1.data.nodes.map(node => node.node_key);
				const invalidNodeKey = connections.some(conn => !allNodeKeys.includes(conn.node_key));

				if (invalidNodeKey) {
					vk.toast("选择的下一节点不存在，请重新选择");
					return;
				}

				const selfNode = connections.some(conn => conn.node_key === this.connectionDialog.currentNode.node_key);
				if (selfNode) {
					vk.toast("不能将当前节点设置为自己的下一节点");
					return;
				}

				this.$set(this.form1.data.nodes[this.connectionDialog.currentNodeIndex], 'next_nodes', vk.pubfn.copyObject(
					connections));
				this.connectionDialog.show = false;
				vk.toast("连接配置保存成功");
			},
			// 节点验证器
			validateNodes(rule, value, callback) {
				if (!value || value.length === 0) {
					callback(new Error("请至少配置一个节点"));
					return;
				}

				const hasStart = value.some(node => node.node_type === 'start');
				const hasEnd = value.some(node => node.node_type === 'end');

				if (!hasStart) {
					callback(new Error("必须包含一个开始节点"));
					return;
				}

				if (!hasEnd) {
					callback(new Error("必须包含一个结束节点"));
					return;
				}

				// 检查节点KEY是否重复
				const keys = value.map(node => node.node_key);
				const uniqueKeys = [...new Set(keys)];
				if (keys.length !== uniqueKeys.length) {
					callback(new Error("节点KEY不能重复"));
					return;
				}

				// 检查开始节点是否有下一节点
				const startNode = value.find(node => node.node_type === 'start');
				if (startNode && (!startNode.next_nodes || startNode.next_nodes.length === 0)) {
					callback(new Error("开始节点必须配置下一节点"));
					return;
				}

				// 检查结束节点是否有下一节点（结束节点不应该有下一节点）
				const endNodes = value.filter(node => node.node_type === 'end');
				for (let endNode of endNodes) {
					if (endNode.next_nodes && endNode.next_nodes.length > 0) {
						callback(new Error("结束节点不能有下一节点"));
						return;
					}
				}

				callback();
			},
			// 获取节点类型显示文本
			getNodeTypeText(type) {
				const typeMap = {
					start: '开始',
					end: '结束',
					userTask: '用户任务',
					approval: '审批',
					review: '通知',
					gateway: '网关'
				};
				return typeMap[type] || type;
			},
			// 获取负责人显示文本
			getAssigneeText(node) {
				const typeMap = {
					user: `用户: ${node.assignee_value}`,
					role: `角色: ${node.assignee_value}`,
					department: `部门: ${node.assignee_value}`,
					variable: `变量: ${node.assignee_value}`,
					previous: '上一处理人'
				};
				return typeMap[node.assignee_type] || '未指定';
			},
			// 根据节点KEY获取节点名称
			getNodeName(nodeKey) {
				const node = this.form1.data.nodes.find(n => n.node_key === nodeKey);
				return node ? node.node_name : nodeKey;
			},
			// 获取操作显示文本
			getActionText(action) {
				const actionMap = {
					submit: '提交',
					approve: '同意',
					reject: '拒绝',
					return: '退回',
					transfer: '转办',
					// delegate: '委托'
				};
				return actionMap[action] || action;
			},
			// 验证节点设计
			validateNodeDesign() {
				this.validateNodes(null, this.form1.data.nodes, (error) => {
					if (error) {
						vk.toast(error.message);
					} else {
						vk.toast("节点设计验证通过");
					}
				});
			},
			// 显示设计帮助
			showDesignHelp() {
				this.$alert(
					`<div style="line-height: 1.6;">
						<h3>流程节点设计指南</h3>
						<p><strong>开始节点：</strong>每个流程必须且只能有一个开始节点</p>
						<p><strong>结束节点：</strong>每个流程至少需要一个结束节点</p>
						<p><strong>任务节点：</strong>用户需要处理的具体任务</p>
						<p><strong>审批节点：</strong>支持多人审批，可设置需要同意的人数</p>
						<p><strong>通知节点：</strong>通知知悉，无需审批操作，仅用于通知和确认</p>
						<p><strong>网关节点：</strong>用于实现条件分支和并行处理</p>
						<br>
						<p><strong>设计建议：</strong></p>
						<ul>
							<li>为每个节点设置清晰的名称和描述</li>
							<li>合理设置负责人和审批规则</li>
							<li>使用条件分支处理复杂的业务逻辑</li>
							<li>测试流程确保流转路径正确</li>
						</ul>
						<br>
						<h3>操作类型设计指南</h3>
						<p><strong>approve (同意/通过)：</strong>同意当前申请，推进到下一节点</p>
						<p><strong>reject (拒绝)：</strong>拒绝当前申请，结束流程</p>
						<p><strong>return (退回)：</strong>将申请退回到指定节点（通常是申请人）</p>
					    <p><strong>transfer (转交)：</strong>将当前任务转交给其他用户处理</p>
						<p><strong>delegate (委托)：</strong>将任务委托给他人，但保留最终确认权</p>	
						<p><strong>confirm (确认/知悉)：</strong>简单的确认操作，主要用于阅知节点</p>		
						<p><strong>resubmit (重新提交)：</strong>被退回后重新提交申请</p>											
					</div>`,
					'设计帮助', {
						dangerouslyUseHTMLString: true,
						confirmButtonText: '知道了'
					}
				);
			}
		}
	};
</script>

<style lang="scss" scoped>
	.page-body {
		padding: 24rpx;
	}

	.action-bar {
		margin-bottom: 24rpx;
		padding: 20rpx;
		background: #fff;
		border-radius: 8rpx;
		box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.1);
	}

	.form-section {
		margin-bottom: 32rpx;

		.section-header {
			display: flex;
			flex-direction: column;
			margin-bottom: 24rpx;
			padding-bottom: 16rpx;
			border-bottom: 2rpx solid #f0f2f5;

			.section-title {
				font-size: 32rpx;
				font-weight: 600;
				color: #303133;
				margin-bottom: 8rpx;
			}

			.section-desc {
				font-size: 26rpx;
				color: #909399;
			}
		}
	}

	.node-designer {
		border: 2rpx solid #e4e7ed;
		border-radius: 12rpx;
		padding: 32rpx;
		background: #fff;
	}

	.designer-toolbar {
		display: flex;
		gap: 16rpx;
		margin-bottom: 24rpx;
		padding-bottom: 24rpx;
		border-bottom: 1rpx solid #e4e7ed;
	}

	.node-stats {
		display: flex;
		gap: 32rpx;
		margin-bottom: 24rpx;
		padding: 20rpx;
		background: #f8f9fa;
		border-radius: 8rpx;

		.stat-item {
			display: flex;
			flex-direction: column;
			align-items: center;

			.stat-label {
				font-size: 24rpx;
				color: #909399;
				margin-bottom: 8rpx;
			}

			.stat-value {
				font-size: 28rpx;
				font-weight: 600;
				color: #303133;
			}
		}
	}

	.nodes-container {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(380rpx, 1fr));
		gap: 24rpx;
		margin-bottom: 32rpx;
	}

	.empty-nodes {
		grid-column: 1 / -1;
		text-align: center;
		padding: 80rpx 20rpx;
		background: #fafafa;
		border: 2rpx dashed #dcdfe6;
		border-radius: 12rpx;

		.empty-image {
			width: 120rpx;
			height: 120rpx;
			margin-bottom: 24rpx;
			opacity: 0.6;
		}

		.empty-title {
			display: block;
			font-size: 32rpx;
			color: #909399;
			margin-bottom: 16rpx;
		}

		.empty-desc {
			display: block;
			font-size: 26rpx;
			color: #c0c4cc;
		}
	}

	.node-item {
		background: white;
		border: 2rpx solid #e4e7ed;
		border-radius: 12rpx;
		padding: 24rpx;
		box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;

		&:hover {
			box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.12);
			transform: translateY(-4rpx);
		}

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			width: 8rpx;
			height: 100%;
		}
	}

	.node-start::before {
		background: #52c41a;
	}

	.node-end::before {
		background: #fa541c;
	}

	.node-userTask::before,
	.node-approval::before,
	.node-review::before {
		background: #1890ff;
	}

	.node-gateway::before {
		background: #722ed1;
	}

	.node-header {
		display: flex;
		align-items: flex-start;
		margin-bottom: 20rpx;

		.node-badge {
			background: #f0f2f5;
			border-radius: 6rpx;
			padding: 8rpx 12rpx;
			margin-right: 16rpx;

			.node-index {
				font-size: 22rpx;
				font-weight: 600;
				color: #606266;
			}
		}

		.node-info {
			flex: 1;

			.node-name {
				display: block;
				font-size: 28rpx;
				font-weight: 600;
				color: #303133;
				margin-bottom: 4rpx;
			}

			.node-key {
				display: block;
				font-size: 22rpx;
				color: #909399;
				font-family: monospace;
			}
		}

		.node-type-tag {
			background: #409eff;
			color: white;
			padding: 6rpx 12rpx;
			border-radius: 20rpx;
			font-size: 20rpx;

			text {
				font-size: 20rpx;
			}
		}
	}

	.node-start .node-type-tag {
		background: #52c41a;
	}

	.node-end .node-type-tag {
		background: #fa541c;
	}

	.node-userTask .node-type-tag,
	.node-approval .node-type-tag,
	.node-review .node-type-tag {
		background: #1890ff;
	}

	.node-gateway .node-type-tag {
		background: #722ed1;
	}

	.node-content {
		display: flex;
		flex-direction: column;
		gap: 12rpx;
		margin-bottom: 20rpx;
	}

	.node-field {
		display: flex;
		align-items: flex-start;

		.field-label {
			font-size: 24rpx;
			color: #606266;
			width: 140rpx;
			flex-shrink: 0;
		}

		.field-value {
			font-size: 24rpx;
			color: #303133;
			flex: 1;
		}
	}

	.actions-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8rpx;

		.action-tag {
			background: #ecf5ff;
			color: #409eff;
			padding: 4rpx 12rpx;
			border-radius: 12rpx;
			font-size: 20rpx;
			border: 1rpx solid #d9ecff;
		}
	}

	.next-nodes {
		margin-top: 16rpx;
		padding-top: 16rpx;
		border-top: 1rpx dashed #e4e7ed;

		.next-label {
			display: block;
			font-size: 22rpx;
			color: #909399;
			margin-bottom: 8rpx;
		}

		.next-nodes-list {
			display: flex;
			flex-direction: column;
			gap: 8rpx;
		}

		.next-node-item {
			display: inline-flex;
			align-items: center;
			font-size: 22rpx;
			color: #1890ff;
			background: #f0f7ff;
			padding: 8rpx 16rpx;
			border-radius: 8rpx;
			border: 1rpx solid #d1e8ff;

			.condition-tag {
				font-size: 18rpx;
				color: #fa541c;
				background: #fff2e8;
				padding: 2rpx 8rpx;
				border-radius: 6rpx;
				margin-left: 8rpx;
			}

			.default-tag {
				font-size: 18rpx;
				color: #52c41a;
				background: #f6ffed;
				padding: 2rpx 8rpx;
				border-radius: 6rpx;
				margin-left: 8rpx;
			}
		}
	}

	.node-actions {
		display: flex;
		gap: 8rpx;
		justify-content: flex-end;
	}

	.design-tips {
		background: #f0f7ff;
		border: 1rpx solid #d1e8ff;
		border-radius: 8rpx;
		padding: 24rpx;

		.tips-header {
			margin-bottom: 16rpx;

			.tips-title {
				font-size: 26rpx;
				font-weight: 600;
				color: #1890ff;
			}
		}

		.tips-list {
			margin: 0;
			padding-left: 32rpx;

			li {
				font-size: 24rpx;
				color: #606266;
				margin-bottom: 8rpx;
				line-height: 1.5;
			}
		}
	}

	/* 节点编辑弹窗样式 */
	.node-form-dialog {
		::v-deep .el-tabs__header {
			margin-bottom: 24rpx;
		}

		::v-deep .el-tab-pane {
			padding: 0 8rpx;
		}
	}

	/* 连接配置弹窗样式 */
	.connection-dialog {
		padding: 0 8rpx;
	}

	.current-node-info {
		margin-bottom: 32rpx;

		.current-node-card {
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			padding: 24rpx;
			border-radius: 12rpx;
			position: relative;
			overflow: hidden;

			&::before {
				content: '';
				position: absolute;
				top: 0;
				right: 0;
				width: 120rpx;
				height: 120rpx;
				background: rgba(255, 255, 255, 0.1);
				border-radius: 50%;
				transform: translate(30rpx, -30rpx);
			}

			.card-label {
				display: block;
				font-size: 24rpx;
				opacity: 0.9;
				margin-bottom: 8rpx;
			}

			.node-name {
				display: block;
				font-size: 32rpx;
				font-weight: 600;
				margin-bottom: 4rpx;
			}

			.node-key {
				display: block;
				font-size: 24rpx;
				opacity: 0.8;
				margin-bottom: 8rpx;
				font-family: monospace;
			}

			.node-type {
				display: inline-block;
				background: rgba(255, 255, 255, 0.2);
				padding: 4rpx 12rpx;
				border-radius: 20rpx;
				font-size: 22rpx;
			}
		}
	}

	.connections-section {
		margin-bottom: 32rpx;

		.section-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 24rpx;

			.section-title {
				font-size: 28rpx;
				font-weight: 600;
				color: #303133;
			}
		}
	}

	.connections-list {
		display: flex;
		flex-direction: column;
		gap: 20rpx;
	}

	.empty-connections {
		text-align: center;
		padding: 60rpx 20rpx;
		background: #fafafa;
		border: 2rpx dashed #e4e7ed;
		border-radius: 8rpx;

		.empty-text {
			font-size: 26rpx;
			color: #909399;
		}
	}

	.connection-item {
		background: #f8f9fa;
		border: 1rpx solid #e4e7ed;
		border-radius: 8rpx;
		padding: 20rpx;

		.connection-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 16rpx;

			.connection-title {
				font-size: 24rpx;
				font-weight: 600;
				color: #303133;
			}
		}

		.connection-form {
			.form-row {
				display: flex;
				gap: 20rpx;
				margin-bottom: 16rpx;

				&:last-child {
					margin-bottom: 0;
				}

				.form-field {
					flex: 1;

					.field-label {
						display: block;
						font-size: 24rpx;
						color: #606266;
						margin-bottom: 8rpx;
					}
				}
			}
		}
	}

	.connection-guide {
		background: #f6ffed;
		border: 1rpx solid #b7eb8f;
		border-radius: 8rpx;
		padding: 24rpx;

		.guide-header {
			margin-bottom: 16rpx;

			.guide-title {
				font-size: 26rpx;
				font-weight: 600;
				color: #52c41a;
			}
		}

		.guide-content {
			display: flex;
			flex-direction: column;
			gap: 12rpx;

			.guide-item {
				display: flex;
				align-items: flex-start;
				gap: 12rpx;

				.guide-icon {
					font-size: 24rpx;
					flex-shrink: 0;
					margin-top: 2rpx;
				}

				.guide-text {
					font-size: 24rpx;
					color: #606266;
					line-height: 1.5;
				}
			}
		}
	}

	/* 响应式调整 */
	@media (max-width: 768px) {
		.nodes-container {
			grid-template-columns: 1fr;
		}

		.node-stats {
			flex-wrap: wrap;
			justify-content: space-around;
		}

		.connection-form .form-row {
			flex-direction: column;
		}
	}
</style>

<style>
	.process-definition-dialog .el-dialog__body {
		padding: 20px 25px;
	}

	.process-definition-dialog .vk-data-form-item {
		margin-bottom: 20px;
	}
</style>