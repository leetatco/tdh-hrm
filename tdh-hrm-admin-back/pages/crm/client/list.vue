<template>
	<view class="page-body">
		<!-- 页面内容开始 -->

		<!-- 表格搜索组件开始 -->
		<vk-data-table-query v-model="queryForm1.formData" :columns="queryForm1.columns" @search="search">
			<template v-slot:establishmentDate>
				<vk-data-input-date-time v-model="queryForm1.formData.establishmentDate" type="daterange" /></template>
		</vk-data-table-query>
		<!-- 表格搜索组件结束 -->

		<!-- 自定义按钮区域开始 -->
		<view>
			<el-row>
				<el-button type="success" size="small" icon="el-icon-circle-plus-outline"
					v-if="$hasRole('admin') || $hasPermission('client-info-add')" @click="addBtn">添加</el-button>
				<!-- 批量操作 -->
				<el-dropdown v-if="table1.multipleSelection" :split-button="false" trigger="click" @command="batchBtn">
					<el-button type="danger" size="small" style="margin-left: 20rpx;"
						:disabled="table1.multipleSelection.length === 0">
						批量操作<i class="el-icon-arrow-down el-icon--right"></i>
					</el-button>
					<el-dropdown-menu slot="dropdown">
						<el-dropdown-item :command="1">批量删除</el-dropdown-item>
						<el-dropdown-item :command="2">批量导出</el-dropdown-item>
					</el-dropdown-menu>
				</el-dropdown>
			</el-row>
		</view>
		<!-- 自定义按钮区域结束 -->

		<!-- 表格组件开始 -->
		<vk-data-table ref="table1" :action="table1.action" :columns="table1.columns" :query-form-param="queryForm1"
			:right-btns="table1.rightBtns" :selection="true" :row-no="true" :pagination="true" @update="updateBtn"
			@delete="deleteBtn" @current-change="currentChange" @selection-change="selectionChange"></vk-data-table>
		<!-- 表格组件结束 -->

		<!-- 添加或编辑的弹窗开始 -->
		<vk-data-dialog v-model="form1.props.show" :title="form1.props.title" width="800px" mode="form"
			:close-on-click-modal="false">
			<vk-data-form v-model="form1.data" :rules="form1.props.rules" :action="form1.props.action"
				:form-type="form1.props.formType" :columns='form1.props.columns' :inline="true" label-width="140px"
				:columnsNumber="2" @success="form1.props.show = false;refresh();"></vk-data-form>
		</vk-data-dialog>
		<!-- 添加或编辑的弹窗结束 -->

		<!-- 页面内容结束 -->
	</view>
</template>

<script>
	let vk = uni.vk; // vk实例
	let originalForms = {}; // 表单初始化数据
	const colWidth = 200;
	export default {
		data() {
			// 页面数据变量
			return {
				// 页面是否请求中或加载中
				loading: false,
				// init请求返回的数据
				data: {

				},
				// 表格相关开始 -----------------------------------------------------------
				table1: {
					// 表格数据请求地址
					action: "admin/crm/client/sys/getList",
					//按钮显示
					rightBtns: [{
							mode: 'detail_auto',
							title: '详细',
							show: (item) => {
								return this.$hasRole('admin') || this.$hasPermission('client-info-view')
							}
						},
						{
							mode: 'update',
							title: '编辑',
							show: (item) => {
								return this.$hasRole('admin') || this.$hasPermission('client-info-edit')
							}
						},
						{
							mode: 'delete',
							title: '删除',
							show: (item) => {
								return this.$hasRole('admin') || this.$hasPermission('client-info-delete')
							}
						}
					],
					// 表格字段显示规则
					columns: [{
							"key": "companyName",
							"title": "企业名称",
							"type": "text",
							"width": colWidth
						},
						{
							"key": "industry",
							"title": "所属行业",
							"type": "text",
							"width": colWidth - 50
						},
						{
							"key": "establishmentDate",
							"title": "成立时间",
							"type": "date",
							"dateType": "date",
							"valueFormat": "yyyy-MM-dd",
							"width": colWidth - 50
						},
						{
							"key": "registeredCapital",
							"title": "注册资本",
							"type": "number",
							"width": colWidth - 50,
							"formatter": (val) => {
								return val ? val + '万元' : '';
							}
						},
						{
							"key": "contactName",
							"title": "对接人",
							"type": "text",
							"width": colWidth - 50
						},
						{
							"key": "contactPhone",
							"title": "联系电话",
							"type": "text",
							"width": colWidth - 50
						},
						{
							"key": "employeeCount",
							"title": "员工总数",
							"type": "number",
							"width": colWidth - 50
						},
						{
							"key": "monthlyPayroll",
							"title": "月工资额",
							"type": "number",
							"width": colWidth - 50,
							"formatter": (val) => {
								return val ? val + '万元' : '';
							}
						},
						{
							"key": "softwareCopyrights",
							"title": "软件著作权",
							"type": "number",
							"width": colWidth - 50
						},
						{
							"key": "inventionAuthorized",
							"title": "发明授权",
							"type": "number",
							"width": colWidth - 50
						},
						{
							"key": "update_date",
							"title": "更新时间",
							"type": "time",
							"width": colWidth,
							"show": ["detail"]
						},
						{
							"key": "users.nickname",
							"title": "更新人",
							"type": "text",
							"width": colWidth,
							"show": ["detail"]
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
					formData: {

					},
					// 查询表单的字段规则 fieldName:指定数据库字段名,不填默认等于key
					columns: [{
							"key": "companyName",
							"title": "企业名称",
							"type": "text",
							"width": colWidth,
							"mode": "%%"
						},
						{
							"key": "industry",
							"title": "所属行业",
							"type": "text",
							"width": colWidth - 50,
							"mode": "%%"
						},
						{
							"key": "contactName",
							"title": "对接人姓名",
							"type": "text",
							"width": colWidth - 50,
							"mode": "%%"
						},
						{
							"key": "contactPhone",
							"title": "联系电话",
							"type": "text",
							"width": colWidth - 50,
							"mode": "%%"
						},
						{
							"key": "establishmentDate",
							"title": "成立时间",
							"type": "daterange",
							"dateType": "datetime",
							"width": colWidth,
							"mode": "[]"
						}
					]
				},
				form1: {
					// 表单请求数据，此处可以设置默认值
					data: {},
					// 表单属性
					props: {
						// 表单请求地址
						action: "",
						// 表单字段显示规则
						columns: [{
								"key": "companyName",
								"title": "企业名称",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "industry",
								"title": "所属行业",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "establishmentDate",
								"title": "成立时间",
								"type": "date",
								"dateType": "date",
								"width": colWidth
							},
							{
								"key": "registeredCapital",
								"title": "注册资本(万元)",
								"type": "number",
								"precision": 2,
								"width": colWidth
							},
							{
								"key": "paidInCapital",
								"title": "实收资本(万元)",
								"type": "number",
								"precision": 2,
								"width": colWidth
							},
							{
								"key": "companyAddress",
								"title": "公司地址",
								"type": "textarea",
								"maxlength": "200",
								"showWordLimit": true,
								"width": colWidth,
								"autosize": {
									minRows: 2,
									maxRows: 4
								}
							},
							{
								"key": "contactName",
								"title": "对接人姓名",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "contactPhone",
								"title": "对接人电话",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "contactPosition",
								"title": "对接人职务",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "taxpayerType",
								"title": "纳税人类型",
								"type": "select",
								"multiple": true,
								"data": [{
										"value": "一般纳税人",
										"label": "一般纳税人"
									},
									{
										"value": "小微企业",
										"label": "小微企业"
									},
									{
										"value": "个体户",
										"label": "个体户"
									}
								],
								"width": colWidth
							},
							{
								"key": "enterpriseNature",
								"title": "企业性质",
								"type": "select",
								"multiple": true,
								"data": [{
										"value": "内资企业",
										"label": "内资企业"
									},
									{
										"value": "台资企业",
										"label": "台资企业"
									},
									{
										"value": "港资企业",
										"label": "港资企业"
									},
									{
										"value": "中外合资",
										"label": "中外合资"
									},
									{
										"value": "外资企业",
										"label": "外资企业"
									}
								],
								"width": colWidth
							},
							{
								"key": "listingType",
								"title": "上市类型",
								"type": "select",
								"multiple": true,
								"data": [{
										"value": "未上市",
										"label": "未上市"
									},
									{
										"value": "国内主板上市公司",
										"label": "国内主板上市公司"
									},
									{
										"value": "港板",
										"label": "港板"
									},
									{
										"value": "新三板",
										"label": "新三板"
									},
									{
										"value": "其它列明",
										"label": "其它列明"
									}
								],
								"width": colWidth
							},
							{
								"key": "listingBoard",
								"title": "上市板块",
								"type": "text",
								"width": colWidth,
								"placeholder": "如：创业板、科创板等"
							},
							{
								"key": "enterpriseQualifications",
								"title": "企业资质",
								"type": "select",
								"multiple": true,
								"data": [{
										"value": "国高认证",
										"label": "国高认证"
									},
									{
										"value": "专精新认证",
										"label": "专精新认证"
									},
									{
										"value": "科小认证",
										"label": "科小认证"
									}
								],
								"width": colWidth
							},
							{
								"key": "basicAccountBank",
								"title": "基本户银行",
								"type": "text",
								"width": colWidth,
								"placeholder": "请输入基本户银行"
							},
							{
								"key": "employeeCount",
								"title": "员工总数",
								"type": "number",
								"width": colWidth,
								"placeholder": "请输入员工总数"
							},
							{
								"key": "monthlyPayroll",
								"title": "月代发工资额(万元)",
								"type": "number",
								"precision": 2,
								"width": colWidth,
								"placeholder": "请输入月代发工资额"
							},
							{
								"key": "seniorCertified",
								"title": "高级认证人数",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "intermediateCertified",
								"title": "中级认证人数",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "masterDegree",
								"title": "硕士人数",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "doctorDegree",
								"title": "博士及以上人数",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "legalRepresentative",
								"title": "法人",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "actualController",
								"title": "实际控制人",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "generalManager",
								"title": "总经理",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "coreStaff",
								"title": "核心人员(逗号分隔)",
								"type": "text",
								"width": colWidth,
								"placeholder": "请输入核心人员姓名，多个用逗号分隔",
							},

							{
								"key": "shareholders",
								"title": "股东情况",
								"type": "text",
								"width": colWidth,
							},
							{
								"key": "controllerShareholding",
								"title": "实控人持股比例(%)",
								"type": "number",
								"precision": 2,
								"width": colWidth
							},
							{
								"key": "companyIntroduction",
								"title": "公司介绍",
								"type": "textarea",
								"maxlength": "200",
								"showWordLimit": true,
								"width": colWidth,
								"autosize": {
									minRows: 2,
									maxRows: 4
								}
							},
							{
								"key": "softwareCopyrights",
								"title": "软件著作权数量",
								"type": "number",
								"width": colWidth
							}, {
								"key": "companyHolding",
								"title": "股东关系说明",
								"type": "textarea",
								"maxlength": "200",
								"showWordLimit": true,
								"width": colWidth,
								"autosize": {
									minRows: 2,
									maxRows: 4
								}
							},
							{
								"key": "trademarksTotal",
								"title": "商标总数",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "trademarksBrandCount",
								"title": "其中品牌数",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "inventionAuthorized",
								"title": "发明授权数量",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "specialTechnologies",
								"title": "专项技术",
								"type": "textarea",
								"width": colWidth,
								"autosize": {
									minRows: 2,
									maxRows: 4
								}
							},
							{
								"key": "utilityModel",
								"title": "实用新型数量",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "appearanceDesign",
								"title": "外观设计数量",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "inventionPublished",
								"title": "发明公布数量",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "rdPersonnelCount",
								"title": "研发人数",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "rdInvestment",
								"title": "研发投入介绍",
								"type": "textarea",
								"maxlength": "200",
								"showWordLimit": true,
								"width": colWidth,
								"autosize": {
									minRows: 2,
									maxRows: 4
								}
							}
						],
						// 表单验证规则
						rules: {
							companyName: [{
								required: true,
								message: "企业名称不能为空",
								trigger: ['blur', 'change']
							}],
							industry: [{
								required: true,
								message: "所属行业不能为空",
								trigger: ['blur', 'change']
							}],
							establishmentDate: [{
								required: true,
								message: "成立时间不能为空",
								trigger: ['blur', 'change']
							}],
							registeredCapital: [{
								required: true,
								message: "注册资本不能为空",
								trigger: ['blur', 'change']
							}],
							companyAddress: [{
								required: true,
								message: "公司地址不能为空",
								trigger: ['blur', 'change']
							}],
							contactName: [{
								required: true,
								message: "对接人姓名不能为空",
								trigger: ['blur', 'change']
							}],
							contactPhone: [{
									required: true,
									message: "对接人电话不能为空",
									trigger: ['blur', 'change']
								},
								{
									validator: vk.pubfn.validator("mobile"),
									message: '电话格式错误',
									trigger: 'blur'
								}
							],
							employeeCount: [{
								required: true,
								message: "员工总数不能为空",
								trigger: ['blur', 'change']
							}],
							legalRepresentative: [{
								required: true,
								message: "法人不能为空",
								trigger: ['blur', 'change']
							}],
							actualController: [{
								required: true,
								message: "实际控制人不能为空",
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
				},
				// 其他弹窗表单
				formDatas: {},
				// 表单相关结束 -----------------------------------------------------------
			};
		},
		// 监听 - 页面每次【加载时】执行(如：前进)
		onLoad(options = {}) {
			vk = this.vk;
			this.options = options;
			this.init(options);
		},
		// 监听 - 页面【首次渲染完成时】执行。注意如果渲染速度快，会在页面进入动画完成前触发
		onReady() {

		},
		// 监听 - 页面每次【显示时】执行(如：前进和返回) (页面每次出现在屏幕上都触发，包括从下级页面点返回露出当前页面)
		onShow() {

		},
		// 监听 - 页面每次【隐藏时】执行(如：返回)
		onHide() {

		},
		// 函数
		methods: {
			// 页面数据初始化函数
			init(options) {
				originalForms["form1"] = vk.pubfn.copyObject(this.form1);
			},
			// 页面跳转
			pageTo(path) {
				vk.navigateTo(path);
			},
			// 表单重置
			resetForm() {
				vk.pubfn.resetForm(originalForms, this);
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
				this.form1.props.action = 'admin/crm/client/sys/add';
				this.form1.props.formType = 'add';
				this.form1.props.title = '添加客户资料';
				this.form1.props.show = true;
			},
			// 显示修改页面
			updateBtn({
				item
			}) {
				this.form1.props.action = 'admin/crm/client/sys/update';
				this.form1.props.formType = 'update';
				this.form1.props.title = '编辑客户资料';
				this.form1.props.show = true;
				this.form1.data = item;
			},
			// 删除按钮
			deleteBtn({
				item,
				deleteFn
			}) {
				deleteFn({
					action: "admin/crm/client/sys/delete",
					data: {
						_id: item._id
					},
				});
			},
			// 监听 - 批量操作的按钮点击事件
			batchBtn(index) {
				switch (index) {
					case 1:
						// 批量删除
						if (this.table1.multipleSelection.length === 0) {
							vk.toast("请先选择要删除的记录");
							return;
						}
						vk.confirm("确定要删除选中的" + this.table1.multipleSelection.length + "条记录吗？", "提示", async () => {
							const ids = this.table1.multipleSelection.map(item => item._id);
							const res = await vk.callFunction({
								url: 'admin/crm/client/sys/batchDelete',
								title: '删除中...',
								data: {
									ids: ids
								},
							});
							if (res.code === 0) {
								vk.toast("删除成功");
								this.refresh();
							}
						});
						break;
					case 2:
						// 批量导出
						vk.toast("批量导出功能开发中...");
						break;
					default:
						break;
				}
			}
		},
		// 监听属性
		watch: {

		},
		// 计算属性
		computed: {

		}
	};
</script>
<style lang="scss" scoped>
	.page-body {}
</style>