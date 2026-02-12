<template>
	<view class="page-body">
		<!-- 页面内容开始 -->

		<!-- 表格搜索组件开始 -->
		<vk-data-table-query v-model="queryForm1.formData" :columns="queryForm1.columns"
			@search="search"></vk-data-table-query>
		<!-- 表格搜索组件结束 -->

		<!-- 自定义按钮区域开始 -->
		<view>
			<el-row>
				<!-- <el-button type="success" size="small" icon="el-icon-circle-plus-outline"
					v-if="$hasRole('admin') || $hasRole('fd-add')" @click="addBtn">添加</el-button> -->
				<el-button type="success" v-if="$hasRole('admin') || $hasPermission('hrm-salary-add')" size="small"
					icon="el-icon-circle-plus-outline" @click="autoSalary">自动生成工资表</el-button>
				<el-button type="primary" size="small" icon="el-icon-edit-outline"
					v-if="$hasRole('admin') || $hasPermission('hrm-salary-export')" @click="exportExcelAll"> 导出全部
				</el-button>
				<!-- 批量操作 -->
				<el-dropdown v-if="table1.multipleSelection && ($hasRole('admin') || $hasPermission('hrm-salary-edit'))"
					:split-button="false" trigger="click" @command="batchBtn">
					<el-button type="danger" size="small" style="margin-left: 20rpx;"
						:disabled="table1.multipleSelection.length === 0">
						批量审核<i class="el-icon-arrow-down el-icon--right"></i>
					</el-button>
					<el-dropdown-menu slot="dropdown">
						<el-dropdown-item :command="1">通过</el-dropdown-item>
						<!-- <el-dropdown-item :command="2">未通过</el-dropdown-item> -->
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
		<vk-data-dialog v-model="form1.props.show" :title="form1.props.title" width="700px" mode="form"
			:close-on-click-modal="false">
			<vk-data-form v-model="form1.data" :rules="form1.props.rules" :action="form1.props.action"
				:form-type="form1.props.formType" :columns='form1.props.columns' label-width="100px"
				@success="form1.props.show = false;refresh();" :inline="true" :columnsNumber="2"></vk-data-form>
		</vk-data-dialog>
		<!-- 添加或编辑的弹窗结束 -->

		<!-- 页面内容结束 -->
	</view>
</template>

<script>
	let vk = uni.vk; // vk实例
	let originalForms = {}; // 表单初始化数据
	const colWidth = 200;
	let nowy = new Date(vk.pubfn.getOffsetTime(new Date(), {
		mode: "before", // after 之后 before 之前
	})).getFullYear();

	let nowm = new Date(vk.pubfn.getOffsetTime(new Date(), {
		mode: "before", // after 之后 before 之前
	})).getMonth();

	let nowm1 = nowm > 9 ? nowm : `0${nowm}`;
	const nowym = vk.myfn.normalizeMonth(`${nowy}-${nowm1}`);
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
					action: "admin/hrm/salary/sys/getList",
					//按钮显示
					rightBtns: [{
							mode: 'detail_auto',
							title: '详细',
							show: (item) => {
								return this.$hasRole('admin') || this.$hasPermission('hrm-salary-view')
							}
						},
						{
							mode: 'update',
							title: '编辑',
							show: (item) => {
								return this.$hasRole('admin') || this.$hasPermission('hrm-salary-edit')
							}
						},
						{
							mode: 'delete',
							title: '删除',
							show: (item) => {
								return this.$hasRole('admin') || this.$hasPermission('hrm-salary-delete')
							}
						}
					],
					// 表格字段显示规则
					columns: [{
							"key": "total_salary",
							"title": "综合工资",
							"type": "number",
							"fixed": true,
							"width": colWidth - 100
						},
						{
							"key": "rest_type",
							"title": "休息类型",
							"fixed": true,
							"type": "html",
							"width": colWidth - 100,
							formatter: (val, row, column, index) => {
								if (val == 1) return '单休';
								if (val == 2) return '双休';
								if (val == 3) {
									return '大小周';
								} else {
									if (row.salary_type == 1) return `<text>${row.total_salary}元/月</text>`;
									if (row.salary_type == 2) return `<text>${row.total_salary}元/天</text>`;
									if (row.salary_type == 3) return `<text>${row.total_salary}元/时</text>`;
								}
							}
						},
						{
							"key": "attendance_ym",
							"title": "考勤日期",
							"type": "text",
							"fixed": true,
							"width": colWidth - 100
						},
						{
							"key": "employee_id",
							"title": "员工工号",
							"type": "text",
							"fixed": true,
							"width": colWidth - 100
						},
						{
							"key": "employees.employee_name",
							"title": "员工姓名",
							"type": "text",
							"fixed": true,
							"width": colWidth - 100
						},
						{
							"key": "employees.card",
							"title": "身份证号码",
							"type": "text",
							"fixed": true,
							"width": colWidth - 30
						},
						{
							"key": "employees.departments.department_name",
							"title": "部门",
							"fixed": true,
							"type": "text",
							"width": colWidth,
							formatter: function(val, row, column, index) {
								if (vk.pubfn.isNotNull(row.resign_month)) {
									if (nowym.split('-')[1] != row.resign_month) {
										// console.log("6666666666:",val,nowm1,nowym.split('-')[1]-row.resign_month)
										return row.resign_month + val;
									}
								}
								return val;
							}
						},
						{
							"key": "employees.positions.position_name",
							"title": "职位",
							"type": "text",
							"width": colWidth - 100
						},
						{
							"key": "employees.hire_date",
							"title": "入职日期",
							"type": "date",
							"dateType": "date",
							"valueFormat": "yyyy-MM-dd",
							"width": colWidth - 100
						},
						{
							"key": "resign_month",
							"title": "离职日期",
							"type": "number",
							"width": colWidth - 100,
							formatter: function(val, row, column, index) {
								return val ? val + '月离职工资' : '';
							}
						},
						{
							"key": "base_salary",
							"title": "基本工资",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "performance_salary",
							"title": "绩效工资",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "overtime_fee",
							"title": "固定加班",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "housing_fund",
							"title": "公积补偿金",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "annual_allowance",
							"title": "年度补偿金",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "floating_bonus",
							"title": "浮动奖励",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "confidentiality_fee",
							"title": "保密费",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "work_days",
							"title": "应勤天数",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "real_days",
							"title": "实际出勤",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "gross_salary",
							"title": "应发工资",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "overtime_cost",
							"title": "加班费",
							"type": "text",
							"width": colWidth - 100
						},
						{
							"key": "free_cost",
							"title": "放假补助",
							"type": "number",
							"width": colWidth - 100
						},
						// {
						// 	"key": "grant",
						// 	"title": "补助金",
						// 	"type": "number",
						// 	"width": colWidth - 100
						// },
						{
							"key": "agency_fee",
							"title": "介绍费",
							"type": "text",
							"width": colWidth - 100
						},
						{
							"key": "other_cost",
							"title": "其它费用",
							"type": "text",
							"width": colWidth - 100
						},
						{
							"key": "we_cost",
							"title": "水电费",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "clothes_cost",
							"title": "工衣费用",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "earlytime_cost",
							"title": "迟/早退费",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "missed_cost",
							"title": "未打卡费",
							"type": "number",
							"width": colWidth - 100
						},
						// {
						// 	"key": "loan_cost",
						// 	"title": "借款",
						// 	"type": "number",
						// 	"show": ["none"],
						// 	"width": colWidth - 100
						// },
						{
							"key": "last_month_sb",
							"title": "上月社保",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "last_month_dk",
							"title": "代扣部份",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "this_month_sb",
							"title": "本月社保",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "this_month_dk",
							"title": "代扣部份",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "dkgs",
							"title": "代扣个税",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "real_salary",
							"title": "实发工资",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "company_sb",
							"title": "公司社保",
							"type": "number",
							"width": colWidth - 100
						},
						{
							"key": "company_gjj",
							"title": "公司公积金",
							"type": "number",
							"width": colWidth - 100
						},
						{
							key: "enable_fd1",
							title: "财务审核一级",
							type: "switch",
							activeValue: true,
							inactiveValue: false,
							width: colWidth - 50,
							watch: (res) => {
								let {
									value,
									row,
									change
								} = res;
								vk.callFunction({
									url: "admin/hrm/salary/sys/update",
									title: value ? "通过中..." : "未通过中...",
									data: {
										_id: row._id,
										attendance_ym_key: row.attendance_ym_key,
										employee_id: row.employee_id,
										enable_fd1: value
									},
									success: data => {
										this.refresh();
									}
								});
							}
						},
						{
							"key": "comment",
							"title": "备注",
							"type": "text",
							"width": colWidth,
							"show": ["detail"]
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
						attendance_ym: nowym,
						enable_fd1: false
					},
					// 查询表单的字段规则 fieldName:指定数据库字段名,不填默认等于key
					columns: [{
							key: "attendance_ym",
							title: "考勤日期",
							type: "date",
							dateType: "date",
							valueFormat: "yyyy-MM",
							format: "yyyy-MM",
							// disabled:true,
							// clearable:false,
							"width": colWidth

						}, {
							key: "employee_id",
							title: "",
							type: "table-select",
							placeholder: "选择员工",
							action: "admin/hrm/employees/sys/getList",
							multiple: false,
							columns: [{
									key: "employee_id",
									title: "员工工号",
									type: "text",
									idKey: true
								}, // idKey:true 代表此字段为主键字段，若设置show:["none"],则可以在表格中隐藏该字段的显示
								{
									key: "employee_name",
									title: "员工姓名",
									type: "text",
									nameKey: true
								},
								{
									key: "card",
									title: "身份证号码",
									type: "text",
									nameKey: true

								}
							],
							queryColumns: [{
									key: "employee_id",
									title: "员工工号",
									type: "text",
									width: 150,
									mode: "%%"
								},
								{
									key: "employee_name",
									title: "员工姓名",
									type: "text",
									width: 150,
									mode: "%%"
								},
								{
									key: "card",
									title: "身份证号码",
									type: "text",
									width: 150,
									mode: "%%"
								}

							]
						},
						{
							"key": "enable_fd1",
							"title": "财务审核一级",
							"type": "select",
							"show": ["none"],
							"data": [{
								"value": true,
								"label": "已通过"
							}, {
								"value": false,
								"label": "未通过"
							}],
							"mode": "="
						},
						{
							"key": "enable_fd2",
							"title": "财务审核二级",
							"type": "select",
							"show": ["none"],
							"data": [{
								"value": true,
								"label": "已通过"
							}, {
								"value": false,
								"label": "未通过"
							}],
							"mode": "="
						},
						//{"key":"total_salary","title":"综合工资","type":"number","width":colWidth,"mode":"="},
						//{"key":"rest_type","title":"休息类型","type":"number","width":colWidth,"data":[{"value":1,"label":"单休"},{"value":2,"label":"双休"},{"value":3,"label":"大小周"}],"mode":"="},
						//{"key":"base_salary","title":"基本工资","type":"number","width":colWidth,"mode":"="},
						//{"key":"performance_salary","title":"绩效工资","type":"number","width":colWidth,"mode":"="},
						//{"key":"overtime_fee","title":"固定加班","type":"number","width":colWidth,"mode":"="},
						//{"key":"housing_fund","title":"公积补偿金","type":"number","width":colWidth,"mode":"="},
						//{"key":"annual_allowance","title":"年度补偿金","type":"number","width":colWidth,"mode":"="},
						//{"key":"floating_bonus","title":"浮动奖励","type":"number","width":colWidth,"mode":"="},
						//{"key":"confidentiality_fee","title":"保密费","type":"number","width":colWidth,"mode":"="},
						//{"key":"work_days","title":"应勤天数","type":"number","width":colWidth,"mode":"="},
						//{"key":"real_days","title":"实际出勤","type":"number","width":colWidth,"mode":"="},
						//{"key":"gross_salary","title":"应发工资","type":"number","width":colWidth,"mode":"="},
						//{"key":"overtime_cost","title":"加班费","type":"text","width":colWidth,"mode":"="},
						//{"key":"free_cost","title":"放假补助","type":"number","width":colWidth,"mode":"="},
						//{"key":"grant","title":"补助金","type":"number","width":colWidth,"mode":"="},
						//{"key":"agency_fee","title":"介绍费","type":"text","width":colWidth,"mode":"="},
						//{"key":"other_cost","title":"其它费用","type":"text","width":colWidth,"mode":"="},
						//{"key":"we_cost","title":"水电费","type":"number","width":colWidth,"mode":"="},
						//{"key":"clothes_cost","title":"工衣费用","type":"number","width":colWidth,"mode":"="},
						//{"key":"earlytime_cost","title":"迟/早退费","type":"number","width":colWidth,"mode":"="},
						//{"key":"missed_cost","title":"未打卡费","type":"number","width":colWidth,"mode":"="},
						//{"key":"loan_cost","title":"借款","type":"number","width":colWidth,"mode":"="},
						//{"key":"last_month_sb","title":"上月社保","type":"number","width":colWidth,"mode":"="},
						//{"key":"last_month_dk","title":"上月社保代扣部份","type":"number","width":colWidth,"mode":"="},
						//{"key":"this_month_sb","title":"本月社保","type":"number","width":colWidth,"mode":"="},
						//{"key":"this_month_dk","title":"本月社保代扣部份","type":"number","width":colWidth,"mode":"="},
						//{"key":"dkgs","title":"代扣个税","type":"number","width":colWidth,"mode":"="},
						//{"key":"real_salary","title":"实发工资","type":"number","width":colWidth,"mode":"="},
						//{"key":"company_sb","title":"公司部份社保","type":"number","width":colWidth,"mode":"="},
						//{"key":"comment","title":"备注","type":"text","width":colWidth,"mode":"="},						
						//{"key":"update_date","title":"更新时间","type":"datetimerange","width":colWidth,"mode":"="},
						//{"key":"update_id","title":"更新人","type":"text","width":colWidth,"mode":"="}
					]
				},
				form1: {
					// 表单请求数据，此处可以设置默认值
					data: {

					},
					// 表单属性
					props: {
						// 表单请求地址
						action: "",
						// 表单字段显示规则
						columns: [{
								key: "attendance_ym",
								title: "考勤日期",
								type: "date",
								dateType: "date",
								disabled: true,
								valueFormat: "yyyy-MM",
								format: "yyyy-MM",
								"width": colWidth

							}, {
								key: "employee_id",
								title: "",
								type: "table-select",
								disabled: true,
								placeholder: "选择员工",
								action: "admin/hrm/employees/sys/getList",
								multiple: false,
								columns: [{
										key: "employee_id",
										title: "员工工号",
										type: "text",
										idKey: true
									}, // idKey:true 代表此字段为主键字段，若设置show:["none"],则可以在表格中隐藏该字段的显示	
									{
										key: "employee_name",
										title: "员工姓名",
										type: "text",
										nameKey: true
									},
									{
										key: "card",
										title: "身份证号码",
										type: "text",
										nameKey: true

									}
								],
								queryColumns: [{
										key: "employee_name",
										title: "员工姓名",
										type: "text",
										width: 150,
										mode: "%%"
									}, {
										key: "employee_id",
										title: "员工工号",
										type: "text",
										width: 150,
										mode: "%%"
									},
									{
										key: "card",
										title: "身份证号码",
										type: "text",
										width: 150,
										mode: "%%"
									}

								]
							},
							{
								"key": "total_salary",
								"title": "综合工资",
								"type": "number",
								disabled: true,
								"width": colWidth
							},
							{
								"key": "rest_type",
								"title": "休息类型",
								"type": "select",
								disabled: true,
								"width": colWidth,
								"defaultValue": 1,
								"data": [{
									"value": 1,
									"label": "单休"
								}, {
									"value": 2,
									"label": "双休"
								}, {
									"value": 3,
									"label": "大小周"
								}]
							},
							{
								"key": "base_salary",
								"title": "基本工资",
								"type": "number",
								disabled: true,
								"width": colWidth
							},
							{
								"key": "performance_salary",
								"title": "绩效工资",
								disabled: true,
								"type": "number",
								"width": colWidth
							},
							{
								"key": "overtime_fee",
								"title": "固定加班",
								"type": "number",
								disabled: true,
								"width": colWidth
							},
							{
								"key": "housing_fund",
								"title": "公积补偿金",
								disabled: true,
								"type": "number",
								"width": colWidth
							},
							{
								"key": "annual_allowance",
								"title": "年度补偿金",
								disabled: true,
								"type": "number",
								"width": colWidth
							},
							{
								"key": "floating_bonus",
								"title": "浮动奖励",
								disabled: true,
								"type": "number",
								"width": colWidth
							},
							{
								"key": "confidentiality_fee",
								"title": "保密费",
								disabled: true,
								"type": "number",
								"width": colWidth
							},
							{
								"key": "work_days",
								"title": "应勤天数",
								disabled: true,
								"type": "number",
								"width": colWidth
							},
							{
								"key": "real_days",
								"title": "实际出勤",
								disabled: true,
								"type": "number",
								"width": colWidth
							},
							{
								"key": "gross_salary",
								"title": "应发工资",
								disabled: true,
								"type": "number",
								"width": colWidth
							},
							{
								"key": "overtime_cost",
								"title": "加班费",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "free_cost",
								"title": "放假补助",
								"type": "number",
								"width": colWidth
							},
							// {
							// 	"key": "grant",
							// 	"title": "补助金",
							// 	"type": "number",
							// 	"width": colWidth
							// },
							{
								"key": "agency_fee",
								"title": "介绍费",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "other_cost",
								"title": "其它费用",
								"type": "text",
								"width": colWidth
							},
							{
								"key": "we_cost",
								"title": "水电费",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "clothes_cost",
								"title": "工衣费用",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "earlytime_cost",
								"title": "迟/早退费",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "missed_cost",
								"title": "未打卡费",
								"type": "number",
								"width": colWidth
							},
							// {
							// 	"key": "loan_cost",
							// 	"title": "借款",
							// 	"type": "number",
							// 	"width": colWidth
							// },
							{
								"key": "last_month_sb",
								"title": "上月社保",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "last_month_dk",
								"title": "代扣部份",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "this_month_sb",
								"title": "本月社保",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "this_month_dk",
								"title": "代扣部份",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "dkgs",
								"title": "代扣个税",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "real_salary",
								"title": "实发工资",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "enable_fd1",
								"title": "财务审核一级",
								"type": "switch",
								"width": colWidth
							},
							{
								"key": "company_sb",
								"title": "公司社保",
								"type": "number",
								"width": colWidth
							},
							{
								"key": "company_gjj",
								"title": "公司公积金",
								"type": "number",
								"width": colWidth
							},
							{
								key: "comment",
								title: "备注",
								type: "textarea",
								maxlength: "100",
								showWordLimit: true,
								width: colWidth,
								autosize: {
									minRows: 4,
									maxRows: 10
								}
							}
						],
						// 表单验证规则
						rules: {
							attendance_ym: [{
								required: true,
								message: "该项不能为空",
								trigger: ['blur', 'change']
							}],
							employee_id: [{
								required: true,
								message: "该项不能为空",
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
				// 其它弹窗表单
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
			//自动生成薪资表
			async autoSalary() {
				try {
					vk.confirm(`确定将删除${nowym}月全部数据，重新生成工资表！`, '提示', '确定', '取消', async (res) => {
						if (res.confirm) {
							vk.toast('开始生成工资表...');

							// 1. 获取考勤审核数据
							let resAprove = await vk.callFunction({
								url: 'admin/hrm/salary/pub/getAproveList',
								title: '请求中...',
								data: {
									attendance_ym: nowym,
									enable_hr: true
								},
							});

							if (resAprove.total == 0) {
								return vk.alert(`没有${nowym}月考勤数据，请联系人事考勤！`);
							}

							// 2. 删除旧数据
							let delRes = await vk.callFunction({
								url: 'admin/hrm/salary/sys/all/deleteAll',
								title: '删除中...',
								data: {
									attendance_ym: nowym
								}
							})

							if (delRes.code != 0) {
								return vk.alert(`${nowym}月工资表明细删除失败！`);
							}

							// 3. 提取所有员工信息，用于批量查询
							const employeeIds = resAprove.rows.map(item => item.employee_id);
							const attendanceYmKeys = [...new Set(resAprove.rows.map(item => item
								.attendance_ym_key))];
							const totalSalaries = [...new Set(resAprove.rows.map(item => item.salarys
								.salary))];

							// 批量获取各种数据
							vk.toast('批量获取相关数据...');
							const [
								salaryRulesMap,
								freeMap,
								gsMap,
								sbMap,
								companySbMap
							] = await Promise.all([
								this.batchGetSalaryRules(totalSalaries),
								this.batchGetFreeData(employeeIds, attendanceYmKeys),
								this.batchGetGsData(employeeIds, attendanceYmKeys),
								this.batchGetSbData(employeeIds, attendanceYmKeys),
								this.batchGetCompanySbData(employeeIds, attendanceYmKeys)
							]);

							// 4. 处理每个员工的数据
							const processedRows = [];
							const errors = [];

							for (let item of resAprove.rows) {
								try {
									// 验证定薪数据
									if (vk.pubfn.isNull(item.salarys) || vk.pubfn.isNull(item.salarys
											.salary)) {
										errors.push(
											`员工姓名：${item.employees.employee_name}/${item.employees.employee_id}, 没有定薪数据！`
										);
										continue;
									}

									// 获取薪资分配规则
									const salaryRule = salaryRulesMap.get(item.salarys.salary);
									if (!salaryRule && item.salarys.salary_type == 1) {
										errors.push(
											`综合工资：${item.salarys.salary}, 基本资料：工号-${item.employees.employee_id}/月薪, 没有薪资分配表数据！`
										);
										continue;
									}

									// 处理薪资分配规则
									if (item.salarys.salary_type == 1 && salaryRule) {
										// 月薪类型，调整绩效工资
										if (item.salarys.salary !== salaryRule.total_salary) {
											salaryRule.performance_salary -= (salaryRule.total_salary -
												item.salarys.salary);
										}
										item.bases = salaryRule;
									}

									// 获取其他数据
									const key = `${item.employee_id}_${item.attendance_ym_key}`;
									item.frees = freeMap.get(key) || {};
									item.gss = gsMap.get(key) || {};
									item.sbs = sbMap.get(key) || {};
									item.companysbs = companySbMap.get(key) || {};

									//修改新增人员和时间									
									item.update_date = new Date().getTime();
									item.update_id = vk.getVuex('$user.userInfo._id');

									// 设置工资相关字段
									item = this.setSalaryFields(item);

									// 计算工资
									item = this.calculateSalary(item);

									processedRows.push(item);

								} catch (error) {
									errors.push(
										`处理员工 ${item.employees?.employee_name || item.employee_id} 失败: ${error.message}`
									);
								}
							}

							// 5. 如果有错误，先显示错误
							if (errors.length > 0) {
								const errorMsg = errors.slice(0, 5).join('\n');
								const moreErrors = errors.length > 5 ? `\n...还有${errors.length - 5}条错误` :
									'';

								vk.confirm(
									`发现${errors.length}个错误：\n${errorMsg}${moreErrors}\n\n是否继续处理有效数据？`,
									'处理警告',
									'继续',
									'取消',
									async (confirmRes) => {
										if (confirmRes.confirm) {
											await this.saveSalaryData(processedRows);
										}
									}
								);
							} else {
								await this.saveSalaryData(processedRows);
							}
						}
					});
				} catch (error) {
					console.error('处理过程中发生错误:', error);
					vk.alert(`处理过程中发生错误: ${error.message}`, "系统错误", "确定");
				}
			},
			// 批量获取薪资分配规则
			async batchGetSalaryRules(totalSalaries) {
				const salaryRulesMap = new Map();
				try {
					const res = await vk.callFunction({
						url: 'admin/hrm/salary/pub/getBaseSalary',
						title: '获取薪资规则中...',
						data: {
							total_salaries: totalSalaries,
							match_type: 'range' // 使用区间匹配
						},
					});

					if (res.code === 0 && res.data) {
						// 转换为Map以便快速查找
						Object.entries(res.data).forEach(([salary, rule]) => {
							salaryRulesMap.set(Number(salary), rule);
						});
					}
				} catch (error) {
					console.error('批量获取薪资规则失败:', error);
				}
				return salaryRulesMap;
			},

			// 批量获取放假补助
			async batchGetFreeData(employeeIds, attendanceYmKeys) {
				const freeMap = new Map();

				try {
					// 使用之前创建的批量查询接口
					const res = await vk.callFunction({
						url: 'admin/hrm/salary/sys/all/getfreeAll',
						title: '获取放假补助中...',
						data: {
							employee_ids: employeeIds,
							attendance_ym_keys: attendanceYmKeys
						},
					});

					if (res.code === 0 && res.rows) {
						res.rows.forEach(item => {
							const key = `${item.employee_id}_${item.attendance_ym}`;
							freeMap.set(key, item);
						});
					}

				} catch (error) {
					console.error('批量获取放假补助失败:', error);
				}

				return freeMap;
			},

			// 批量获取代扣个税
			async batchGetGsData(employeeIds, attendanceYmKeys) {
				const gsMap = new Map();

				try {
					const res = await vk.callFunction({
						url: 'admin/hrm/salary/sys/all/getgsAll',
						title: '获取个税数据中...',
						data: {
							employee_ids: employeeIds,
							attendance_ym_keys: attendanceYmKeys
						},
					});

					if (res.code === 0 && res.rows) {
						res.rows.forEach(item => {
							const key = `${item.employee_id}_${item.attendance_ym}`;
							gsMap.set(key, item);
						});
					}

				} catch (error) {
					console.error('批量获取个税数据失败:', error);
				}
				return gsMap;
			},

			// 批量获取个人社保
			async batchGetSbData(employeeIds, attendanceYmKeys) {
				const sbMap = new Map();

				try {
					const res = await vk.callFunction({
						url: 'admin/hrm/salary/sys/all/getsbdkAll',
						title: '获取个人社保中...',
						data: {
							employee_ids: employeeIds,
							attendance_ym_keys: attendanceYmKeys
						},
					});

					if (res.code === 0 && res.rows) {
						res.rows.forEach(item => {
							const key = `${item.employee_id}_${item.attendance_ym}`;
							sbMap.set(key, item);
						});
					}

				} catch (error) {
					console.error('批量获取个人社保失败:', error);
				}

				return sbMap;
			},

			// 批量获取公司社保
			async batchGetCompanySbData(employeeIds, attendanceYmKeys) {
				const companySbMap = new Map();

				try {
					const res = await vk.callFunction({
						url: 'admin/hrm/salary/sys/all/getcomsbAll',
						title: '获取公司社保中...',
						data: {
							employee_ids: employeeIds,
							attendance_ym_keys: attendanceYmKeys
						},
					});

					if (res.code === 0 && res.rows) {
						res.rows.forEach(item => {
							const key = `${item.employee_id}_${item.attendance_ym}`;
							companySbMap.set(key, item);
						});
					}

				} catch (error) {
					console.error('批量获取公司社保失败:', error);
				}

				return companySbMap;
			},

			// 设置工资相关字段
			setSalaryFields(item) {
				// 综合工资
				item.total_salary = item.salarys ? item.salarys.salary : 0;
				// 休息类型
				item.rest_type = item.employees ? item.employees.rest_type : '';
				// 工资类型
				item.salary_type = item.salarys ? item.salarys.salary_type : '';
				// 基本工资
				item.base_salary = item.bases ? item.bases.base_salary : 0;
				// 绩效工资
				item.performance_salary = item.bases ? item.bases.performance_salary : 0;
				// 固定加班
				item.overtime_fee = item.bases ? item.bases.overtime_fee : 0;
				// 公积补偿金
				item.housing_fund = item.bases ? item.bases.housing_fund : 0;
				// 年度补偿金
				item.annual_allowance = item.bases ? item.bases.annual_allowance : 0;
				// 浮动奖励
				item.floating_bonus = item.bases ? item.bases.floating_bonus : 0;
				// 保密费
				item.confidentiality_fee = item.bases ? item.bases.confidentiality_fee : 0;

				// 放假补助
				item.free_cost = item.frees ? item.frees.amount : 0;
				// 介绍费
				item.agency_fee = item.agency_fee || 0;

				// 其它费用(包括奖励和惩罚)
				let reward_cost = item.reward_cost || 0;
				let punish_cost = item.punish_cost || 0;
				let other_cost = item.other_cost || 0;
				item.other_cost = reward_cost + other_cost - punish_cost;

				// 水电费
				item.we_cost = item.share_cost || 0;
				// 工衣费用
				item.clothes_cost = item.clothes_cost || 0;

				// 上月社保
				item.last_month_sb = item.sbs ? item.sbs.last_month_sb : 0;
				// 上月社保代扣部份
				item.last_month_dk = item.sbs ? item.sbs.last_month_dk : 0;
				// 本月社保
				item.this_month_sb = item.sbs ? item.sbs.this_month_sb : 0;
				// 本月社保代扣部份
				item.this_month_dk = item.sbs ? item.sbs.this_month_dk : 0;
				// 代扣个税
				item.dkgs = item.gss ? item.gss.gs : 0;
				// 公司社保和公积金
				item.company_sb = item.companysbs ? item.companysbs.amount : 0;
				item.company_gjj = item.companysbs ? item.companysbs.provident_fund : 0;

				return item;
			},

			// 计算工资
			calculateSalary(item) {
				// 根据定薪表来判断是1:月、2:日、3:时薪，计算工资
				// 基本工资、应勤天数、实际出勤
				if (item.salarys.salary_type == 2 || item.salarys.salary_type == 3) {
					item.base_salary = item.total_salary;
					item.work_days = 1;
				}

				// 计算应发工资=综合工资/应勤天数*实际出勤
				const grossSalary = item.total_salary / item.work_days * item.real_days;
				item.gross_salary = vk.pubfn.toDecimal(grossSalary, 2);

				// 计算实发工资
				let realSalary = item.gross_salary || 0;

				// 加项
				realSalary += item.overtime_cost || 0;
				realSalary += item.free_cost || 0;
				realSalary += item.agency_fee || 0;
				realSalary += item.other_cost || 0;

				// 减项（本月应扣项水电工衣）
				realSalary -= item.we_cost || 0;
				realSalary -= item.clothes_cost || 0;

				// 代扣代缴项社保
				realSalary -= item.last_month_sb || 0;
				realSalary -= item.last_month_dk || 0;
				realSalary -= item.this_month_sb || 0;
				realSalary -= item.this_month_dk || 0;

				// 代扣个税
				realSalary -= item.dkgs || 0;

				// 财务审核状态
				item.enable_fd1 = false;
				item.enable_fd2 = false;

				// 实发工资
				item.real_salary = vk.pubfn.toDecimal(realSalary, 2);

				return item;
			},

			// 保存工资数据
			async saveSalaryData(processedRows) {
				if (processedRows.length === 0) {
					return vk.alert('没有有效数据需要保存！');
				}

				try {
					vk.toast('保存工资表中...');

					const result = await vk.callFunction({
						url: 'admin/hrm/salary/sys/all/addAll',
						title: '请求中...',
						data: {
							items: processedRows
						},
					});

					if (result.code === 0) {
						let resultMessage = `新增工资表完成！成功: ${result.id?.length || processedRows.length}条`;
						vk.alert(resultMessage, "新增成功", "确定", () => {
							this.refresh();
						});
					} else {
						vk.alert(`新增失败: ${result.msg || '未知错误'}`, "系统错误", "确定");
					}

				} catch (error) {
					console.error('保存工资表失败:', error);
					vk.alert(`保存工资表失败: ${error.message}`, "系统错误", "确定");
				}
			},
			// async autoSalary() {
			// 	try {
			// 		vk.confirm(`确定将删除${nowym}月全部数据，重新生成工资表！`, '提示', '确定', '取消', async (res) => {
			// 			if (res.confirm) {
			// 				//考勤审核数据
			// 				let resAprove = await vk.callFunction({
			// 					url: 'admin/hrm/salary/pub/getAproveList',
			// 					title: '请求中...',
			// 					data: {
			// 						attendance_ym: nowym,
			// 						enable_hr: true
			// 					},
			// 				});

			// 				if (resAprove.total == 0) {
			// 					return vk.alert(`没有${nowym}月考勤数据，请联系人事考勤！`);
			// 				}

			// 				// 删除旧数据
			// 				let delRes = await vk.callFunction({
			// 					url: 'admin/hrm/salary/sys/all/deleteAll',
			// 					title: '删除中...',
			// 					data: {
			// 						attendance_ym: nowym
			// 					}
			// 				})

			// 				if (delRes.code != 0) {
			// 					return vk.alert(`${nowym}月工资表明细删除失败！`);
			// 				}


			// 				let count = 0;
			// 				let errorRow = "";

			// 				//工资分配
			// 				for (let item of resAprove.rows) {
			// 					//定薪明细
			// 					if (vk.pubfn.isNull(item.salarys) || vk.pubfn.isNull(item.salarys
			// 							.salary)) {
			// 						return vk.alert(
			// 							`员工姓名：${item.employees.employee_name}/${item.employees.employee_id}, 没有定薪数据！`
			// 						);
			// 					}
			// 					//薪资分配标准(先不区分休息类型)
			// 					let data = await vk.callFunction({
			// 						url: 'admin/hrm/salary/pub/getBaseSalary',
			// 						title: '请求中...',
			// 						data: {
			// 							total_salary: item.salarys.salary,
			// 							// rest_type: item.employees.rest_type
			// 						},
			// 					})

			// 					if (data.total == 0) {
			// 						//如果是月薪是需要设定有薪资分配表数据	
			// 						let type = {
			// 							1: '月薪'
			// 						};
			// 						//月薪需要分配表
			// 						if (vk.pubfn.isNotNull(type[item.salarys.salary_type])) {
			// 							return vk.alert(
			// 								`综合工资：${item.salarys.salary}, 基本资料：工号-${item.employees.employee_id}/${type[item.salarys.salary_type]}, 没有薪资分配表数据！`
			// 							)
			// 						}
			// 						// let type = {
			// 						// 	1: '单休',
			// 						// 	2: '双休',
			// 						// 	3: '大小周'
			// 						// };
			// 						// //无休息类型，是钟点工
			// 						// if (vk.pubfn.isNotNull(type[item.employees.rest_type])) {
			// 						// 	return vk.alert(
			// 						// 		`综合工资：${item.salarys.salary}, 休息类型：工号-${item.employees.employee_id}/${type[item.employees.rest_type]}, 没有设定薪资基本数据！`
			// 						// 	);
			// 						// }
			// 					}
			// 					//定薪工资!==薪资分配表综合工资，重新计算绩效工资，月薪才会有
			// 					if (item.salarys.salary_type == 1) {
			// 						if (item.salarys.salary !== data.rows[0].total_salary) {
			// 							data.rows[0].performance_salary -= (data.rows[0].total_salary -
			// 								item
			// 								.salarys.salary)
			// 						}
			// 						item.bases = data.rows[0];
			// 					}

			// 					//放假补助
			// 					let frees = await vk.callFunction({
			// 						url: 'admin/hrm/salary/sys/free/getList',
			// 						title: '请求中...',
			// 						data: {
			// 							employee_id: item.employee_id,
			// 							attendance_ym: item.attendance_ym_key
			// 						},
			// 					});
			// 					item.frees = frees.rows[0];

			// 					//代扣个税
			// 					let gss = await vk.callFunction({
			// 						url: 'admin/hrm/salary/sys/gs/getList',
			// 						title: '请求中...',
			// 						data: {
			// 							employee_id: item.employee_id,
			// 							attendance_ym: item.attendance_ym_key
			// 						},
			// 					});
			// 					item.gss = gss.rows[0];

			// 					//借款
			// 					// let loans = await vk.callFunction({
			// 					// 	url: 'admin/hrm/salary/sys/loan/getList',
			// 					// 	title: '请求中...',
			// 					// 	data: {
			// 					// 		employee_id: item.employee_id,
			// 					// 		attendance_ym: item.attendance_ym_key
			// 					// 	},
			// 					// });
			// 					// item.loans = loans.rows[0];

			// 					//个人社保
			// 					let sbs = await vk.callFunction({
			// 						url: 'admin/hrm/salary/sys/sbdk/getList',
			// 						title: '请求中...',
			// 						data: {
			// 							employee_id: item.employee_id,
			// 							attendance_ym: item.attendance_ym_key
			// 						},
			// 					});
			// 					item.sbs = sbs.rows[0];

			// 					//公司社保
			// 					let companysbs = await vk.callFunction({
			// 						url: 'admin/hrm/salary/sys/companysb/getList',
			// 						title: '请求中...',
			// 						data: {
			// 							employee_id: item.employee_id,
			// 							attendance_ym: item.attendance_ym_key
			// 						},
			// 					});
			// 					item.companysbs = companysbs.rows[0];

			// 					//综合工资
			// 					item.total_salary = item.salarys ? item.salarys.salary : 0;
			// 					//休息类型
			// 					item.rest_type = item.employees ? item.employees.rest_type : '';
			// 					//工资类型
			// 					item.salary_type = item.salarys ? item.salarys.salary_type : '';
			// 					//基本工资
			// 					item.base_salary = item.bases ? item.bases.base_salary : '';
			// 					//绩效工资
			// 					item.performance_salary = item.bases ? item.bases.performance_salary : '';
			// 					//固定加班
			// 					item.overtime_fee = item.bases ? item.bases.overtime_fee : '';
			// 					//公积补偿金
			// 					item.housing_fund = item.bases ? item.bases.housing_fund : '';
			// 					//年度补偿金
			// 					item.annual_allowance = item.bases ? item.bases.annual_allowance : '';
			// 					//浮动奖励
			// 					item.floating_bonus = item.bases ? item.bases.floating_bonus : '';
			// 					//保密费
			// 					item.confidentiality_fee = item.bases ? item.bases.confidentiality_fee :
			// 						'';
			// 					//放假补助
			// 					item.free_cost = item.frees ? item.frees.amount : '';
			// 					//补助金
			// 					// item.grant = item.grant || '';
			// 					//介绍费
			// 					item.agency_fee = item.agency_fee || '';

			// 					//其它费用(包括奖励和惩罚)	
			// 					let reward_cost = item.reward_cost || 0;
			// 					let punish_cost = item.punish_cost || 0;
			// 					let other_cost = item.other_cost || 0;
			// 					item.other_cost = reward_cost + other_cost - punish_cost;

			// 					//水电费
			// 					item.we_cost = item.share_cost || '';
			// 					//工衣费用
			// 					item.clothes_cost = item.clothes_cost || '';


			// 					//上月社保
			// 					item.last_month_sb = item.sbs ? item.sbs.last_month_sb : '';
			// 					//上月社保代扣部份
			// 					item.last_month_dk = item.sbs ? item.sbs.last_month_dk : '';
			// 					//本月社保									
			// 					item.this_month_sb = item.sbs ? item.sbs.this_month_sb : '';
			// 					//本月社保代扣部份									
			// 					item.this_month_dk = item.sbs ? item.sbs.this_month_dk : '';
			// 					//代扣个税
			// 					item.dkgs = item.gss ? item.gss.gs : '';
			// 					//借款(有算两月工资有借款，算本月一份)
			// 					// item.loan_cost = item.loans ? item.loans.repayment_amount : '';
			// 					// if (vk.pubfn.isNotNull(item.loan_cost) && vk.pubfn.isNotNull(item
			// 					// 		.resign_month)) {
			// 					// 	if (item.resign_month !== nowm) {
			// 					// 		item.loan_cost = "";
			// 					// 	}
			// 					// }
			// 					//公司社保和公积金
			// 					item.company_sb = item.companysbs ? item.companysbs.amount : '';
			// 					item.company_gjj = item.companysbs ? item.companysbs.provident_fund : '';

			// 					//处理婚假 产假 陪产假 工伤 病假 丧假 补助  补考勤
			// 					// row.marriage_leave = res.rows[0].marriage_leave || ""
			// 					// row.maternity_leave = res.rows[0].maternity_leave || ""
			// 					// row.paternity_leave = res.rows[0].paternity_leave || ""
			// 					// row.work_injury = res.rows[0].work_injury || ""
			// 					// row.sick_leave = res.rows[0].sick_leave || ""
			// 					// row.emergency_leave = res.rows[0].emergency_leave || ""
			// 					// row.allowance = res.rows[0].allowance || ""
			// 					// row.attendance_correction = res.rows[0].attendance_correction || ""

			// 					console.log("item:", item);

			// 					//根据定薪表来判断是1:月、2:日、3:时薪，计算工资
			// 					//基本工资、应勤天数、实际出勤
			// 					if (item.salarys.salary_type == 2 || item.salarys.salary_type == 3) {
			// 						item.base_salary = item.total_salary
			// 						item.work_days = 1
			// 					}

			// 					//计算应发工资=综合工资/应勤天数*实际出勤						
			// 					item.gross_salary = vk.pubfn.toDecimal(item.total_salary / item.work_days *
			// 						item.real_days,
			// 						2);

			// 					//计算实发工资
			// 					// 应发工资
			// 					item.real_salary = item.gross_salary || 0
			// 					// 加班费
			// 					item.real_salary += item.overtime_cost || 0
			// 					//放假补助
			// 					item.real_salary += item.free_cost || 0
			// 					//补助金
			// 					// item.real_salary += item.grant || 0
			// 					//介绍费
			// 					item.real_salary += item.agency_fee || 0
			// 					//其它费用
			// 					item.real_salary += item.other_cost || 0

			// 					//本月应扣项水电工衣
			// 					//水电费用
			// 					item.real_salary -= item.we_cost || 0
			// 					//工衣费用
			// 					item.real_salary -= item.clothes_cost || 0

			// 					//代扣代缴项社保
			// 					item.real_salary -= item.last_month_sb || 0
			// 					item.real_salary -= item.last_month_dk || 0
			// 					item.real_salary -= item.this_month_sb || 0
			// 					item.real_salary -= item.this_month_dk || 0
			// 					//代扣个税
			// 					item.real_salary -= item.dkgs || 0

			// 					//借款
			// 					// item.real_salary -= item.loan_cost || 0

			// 					//公司部份社保
			// 					// item.real_salary -= item.company_sb || 0

			// 					// console.log("2:",item.real_salary)

			// 					//财务审核
			// 					//一级
			// 					item.enable_fd1 = false;
			// 					//二级
			// 					item.enable_fd2 = false;
			// 					//实发工资
			// 					item.real_salary = vk.pubfn.toDecimal(item.real_salary, 2);
			// 				}

			// 				const addDates = resAprove.rows;

			// 				const result = await vk.callFunction({
			// 					url: 'admin/hrm/salary/sys/all/addAll',
			// 					title: '请求中...',
			// 					data: {
			// 						items: addDates
			// 					},
			// 				});

			// 				if (result.code === 0) {
			// 					let resultMessage = `新增工资表完成！成功: ${result.id.length}条`;
			// 					vk.alert(resultMessage, "新增成功", "确定", () => {
			// 						this.refresh();
			// 					})
			// 				} else {
			// 					vk.alert(`新增失败!`, "系统错误", "确定");
			// 				}

			// 			}
			// 		})
			// 	} catch (error) {
			// 		console.error('处理过程中发生错误:', error);
			// 		vk.alert(`处理过程中发生错误: ${error.message}`, "系统错误", "确定");
			// 	}
			// },
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
				this.form1.props.action = 'admin/hrm/salary/sys/add';
				this.form1.props.formType = 'add';
				this.form1.props.title = '添加';
				this.form1.props.show = true;
			},
			// 显示修改页面
			updateBtn({
				item
			}) {
				this.form1.props.action = 'admin/hrm/salary/sys/update';
				this.form1.props.formType = 'update';
				this.form1.props.title = '编辑';
				this.form1.props.show = true;
				this.form1.data = item;
			},
			// 删除按钮
			deleteBtn({
				item,
				deleteFn
			}) {
				deleteFn({
					action: "admin/hrm/salary/sys/delete",
					data: {
						_id: item._id
					},
				});
			},
			// 监听 - 批量操作的按钮点击事件
			batchBtn(index) {
				switch (index) {
					case 1:
						this.table1.multipleSelection.forEach(async (e) => {
							let data = await vk.callFunction({
								url: 'admin/hrm/salary/sys/update',
								title: '请求中...',
								data: {
									_id: e._id,
									employee_id: e.employee_id,
									attendance_ym_key: e.attendance_ym_key,
									enable_fd1: true
								}
							})
							if (data.code == 0) vk.alert("批量审核通过成功", "确定",
								() => {
									this.refresh()
								})
						})

						break;
					case 2:
						this.table1.multipleSelection.forEach(async (e) => {
							let data = await vk.callFunction({
								url: 'admin/hrm/salary/sys/update',
								title: '请求中...',
								data: {
									_id: e._id,
									employee_id: e.employee_id,
									attendance_ym_key: e.attendance_ym_key,
									enable_fd1: false
								}
							})
							if (data.code == 0) vk.alert("批量审核未通过成功", "确定",
								() => {
									this.refresh()
								})
						})
						break;
					default:
						break;
				}
			},
			// 导出xls表格文件（全部数据）
			exportExcelAll() {
				this.$refs.table1.exportExcel({
					fileName: nowym + '月份工资表',
					title: "正在导出数据...",
					columns: [{
							"key": "total_salary",
							"title": "综合工资",
							"type": "number"
						},
						{
							"key": "rest_type",
							"title": "休息类型",
							"type": "html",
							formatter: (val, row, column, index) => {
								if (val == 1) return '单休';
								if (val == 2) return '双休';
								if (val == 3) {
									return '大小周';
								} else {
									if (row.salary_type == 1) return `<text>${row.total_salary}元/月</text>`;
									if (row.salary_type == 2) return `<text>${row.total_salary}元/天</text>`;
									if (row.salary_type == 3) return `<text>${row.total_salary}元/时</text>`;
								}
							}
						},
						{
							"key": "attendance_ym",
							"title": "考勤日期",
							"type": "text"
						},
						{
							"key": "employee_id",
							"title": "员工工号",
							"type": "text"
						},
						{
							"key": "employees.employee_name",
							"title": "员工姓名",
							"type": "text"
						},
						{
							"key": "employees.card",
							"title": "身份证号码",
							"type": "text"
						},
						{
							"key": "employees.departments.department_name",
							"title": "部门",
							"type": "text",
							formatter: function(val, row, column, index) {
								if (vk.pubfn.isNotNull(row.resign_month)) {
									if (nowym.split('-')[1] != row.resign_month) {
										// console.log("6666666666:",val,nowm1,nowym.split('-')[1]-row.resign_month)
										return row.resign_month + val;
									}
								}
								return val;
							}
						},
						{
							"key": "employees.positions.position_name",
							"title": "职位",
							"type": "text"
						},
						{
							"key": "employees.hire_date",
							"title": "入职日期",
							"type": "date",
							"dateType": "date",
							"valueFormat": "yyyy-MM-dd"

						},
						{
							"key": "resign_month",
							"title": "离职日期",
							"type": "number",
							formatter: function(val, row, column, index) {
								return val ? val + '月离职工资' : '';
							}
						},
						{
							"key": "base_salary",
							"title": "基本工资",
							"type": "number"
						},
						{
							"key": "performance_salary",
							"title": "绩效工资",
							"type": "number"
						},
						{
							"key": "overtime_fee",
							"title": "固定加班",
							"type": "number"
						},
						{
							"key": "housing_fund",
							"title": "公积补偿金",
							"type": "number"
						},
						{
							"key": "annual_allowance",
							"title": "年度补偿金",
							"type": "number"
						},
						{
							"key": "floating_bonus",
							"title": "浮动奖励",
							"type": "number"
						},
						{
							"key": "confidentiality_fee",
							"title": "保密费",
							"type": "number"
						},
						{
							"key": "work_days",
							"title": "应勤天数",
							"type": "number"
						},
						{
							"key": "real_days",
							"title": "实际出勤",
							"type": "number"
						},
						{
							"key": "gross_salary",
							"title": "应发工资",
							"type": "number"
						},
						{
							"key": "overtime_cost",
							"title": "加班费",
							"type": "text"
						},
						{
							"key": "free_cost",
							"title": "放假补助",
							"type": "number"
						},
						// {
						// 	"key": "grant",
						// 	"title": "补助金",
						// 	"type": "number"
						// },
						{
							"key": "agency_fee",
							"title": "介绍费",
							"type": "text"
						},
						{
							"key": "other_cost",
							"title": "其它费用",
							"type": "text"
						},
						{
							"key": "we_cost",
							"title": "水电费",
							"type": "number"
						},
						{
							"key": "clothes_cost",
							"title": "工衣费用",
							"type": "number"
						},
						{
							"key": "earlytime_cost",
							"title": "迟/早退费",
							"type": "number"
						},
						{
							"key": "missed_cost",
							"title": "未打卡费",
							"type": "number"
						},
						// {
						// 	"key": "loan_cost",
						// 	"title": "借款",
						// 	"type": "number"
						// },
						{
							"key": "last_month_sb",
							"title": "上月社保",
							"type": "number"
						},
						{
							"key": "last_month_dk",
							"title": "代扣部份",
							"type": "number"
						},
						{
							"key": "this_month_sb",
							"title": "本月社保",
							"type": "number"
						},
						{
							"key": "this_month_dk",
							"title": "代扣部份",
							"type": "number"
						},
						{
							"key": "dkgs",
							"title": "代扣个税",
							"type": "number"
						},
						{
							"key": "real_salary",
							"title": "实发工资",
							"type": "number"
						},
						{
							"key": "company_sb",
							"title": "公司社保",
							"type": "number",
						},
						{
							"key": "company_gjj",
							"title": "公司公积金",
							"type": "number",
						},
						{
							key: "enable_fd1",
							title: "财务审核一级",
							type: "text",
							formatter: function(val, row, column, index) {
								return val ? '通过' : '未通过';
							}
						},
						{
							key: "enable_fd2",
							title: "财务审核二级",
							type: "text",
							formatter: function(val, row, column, index) {
								return val ? '通过' : '未通过';
							}
						},
						{
							"key": "comment",
							"title": "备注",
							"type": "text"
						},
					],
					pageIndex: 1,
					pageSize: -1, // 此值为-1，代表导出所有数据
				});
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