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
				<el-button type="primary" size="small" icon="el-icon-edit-outline"
					v-if="$hasRole('admin') || $hasPermission('hrm-salary-export')" @click="exportExcelAll"> 导出全部
				</el-button>
				<!-- 批量操作 -->
				<el-dropdown v-if="table1.multipleSelection && ($hasRole('admin') || $hasPermission('hrm-salary-edit'))" :split-button="false" trigger="click" @command="batchBtn">
					<el-button type="danger" size="small" style="margin-left: 20rpx;"
						:disabled="table1.multipleSelection.length === 0">
						批量审核<i class="el-icon-arrow-down el-icon--right"></i>
					</el-button>
					<el-dropdown-menu slot="dropdown">
						<el-dropdown-item :command="1">通过</el-dropdown-item>
						<el-dropdown-item :command="2">未通过</el-dropdown-item>
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
							"fixed": true,
							"type": "text",
							"width": colWidth - 100
						},
						{
							"key": "employee_id",
							"title": "员工工号",
							"fixed": true,
							"type": "text",
							"width": colWidth - 100
						},
						{
							"key": "employees.employee_name",
							"title": "员工姓名",
							"fixed": true,
							"type": "text",
							"width": colWidth - 100
						},
						{
							"key": "employees.card",
							"title": "身份证号码",
							"fixed": true,
							"type": "text",
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
									if (nowm !== row.resign_month) {
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
						{
							"key": "grant",
							"title": "补助金",
							"type": "number",
							"width": colWidth - 100
						},
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
							"width": colWidth
						},
						{
							"key": "company_gjj",
							"title": "公司公积金",
							"type": "number",
							"width": colWidth
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
							key: "enable_fd2",
							title: "财务审核二级",
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
										enable_fd2: value
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
						enable_fd1: true,
						enable_fd2: false,
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
							"key": "enable_hr",
							"title": "考勤审核",
							"type": "select",
							"width": colWidth,
							"show": ["none"],
							"data": [{
								"value": true,
								"label": "已通过"
							}, {
								"value": false,
								"label": "未通过"
							}],
							"mode": "="
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
						//{"key":"enable_fd","title":"财务审核 true已通过 false未通过","type":"switch","width":colWidth,"mode":"="},
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
							{
								"key": "grant",
								"title": "补助金",
								"type": "number",
								"width": colWidth
							},
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
								"key": "enable_fd2",
								"title": "财务审核二级",
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
				vk.confirm('确定将删除全部原数据，重新生成工资表！', '提示', '确定', '取消', async (res) => {
					if (res.confirm) {
						//考勤审核数据
						let resAprove = await vk.callFunction({
							url: 'admin/hrm/salary/pub/getAproveList',
							title: '请求中...',
							data: {
								attendance_ym: nowym
							},
						});
						//工资分配
						if (resAprove.total == 0) {
							return vk.alert('没有薪资数据！');
						}
						for (let item of resAprove.rows) {
							if (vk.pubfn.isNull(item.salarys) || vk.pubfn.isNull(item.salarys.salary)) {
								return vk.alert(
									`员工姓名：${item.employees.employee_name}/${item.employees.employee_id}, 没有定薪数据！`
								);
							}
							let data = await vk.callFunction({
								url: 'admin/hrm/salary/pub/getBaseSalary',
								title: '请求中...',
								data: {
									total_salary: item.salarys.salary,
									rest_type: item.employees.rest_type
								},
							})
							if (data.total == 0) {
								let type = {
									1: '单休',
									2: '双休',
									3: '大小周'
								};
								//无休息类型，是钟点工
								if (vk.pubfn.isNotNull(type[item.employees.rest_type])) {
									return vk.alert(
										`综合工资：${item.salarys.salary}, 休息类型：${type[item.employees.rest_type]}, 没有设定薪资基本数据！`
									);
								}
							}
							//定薪工资!==薪资分配表综合工资，重新计算绩效工资
							if (item.salarys.salary_type == 1) {
								if (item.salarys.salary !== data.rows[0].total_salary) {
									data.rows[0].performance_salary -= (data.rows[0].total_salary - item
										.salarys.salary)
								}
								item.bases = data.rows[0];
							}
						}

						let count = 0;
						let errorRow = "";
						for (let item of resAprove.rows) {
							let delRes = await vk.callFunction({
								url: 'admin/hrm/salary/sys/delete',
								title: '请求中...',
								data: {
									employee_id: item.employee_id,
									attendance_ym: item.attendance_ym
								},
							})
							if (delRes.code == 0) {
								//综合工资
								item.total_salary = item.salarys ? item.salarys.salary : 0;
								//休息类型
								item.rest_type = item.employees ? item.employees.rest_type : '';
								//工资类型
								item.salary_type = item.salarys ? item.salarys.salary_type : '';
								//基本工资
								item.base_salary = item.bases ? item.bases.base_salary : '';
								//绩效工资
								item.performance_salary = item.bases ? item.bases.performance_salary : '';
								//固定加班
								item.overtime_fee = item.bases ? item.bases.overtime_fee : '';
								//公积补偿金
								item.housing_fund = item.bases ? item.bases.housing_fund : '';
								//年度补偿金
								item.annual_allowance = item.bases ? item.bases.annual_allowance : '';
								//浮动奖励
								item.floating_bonus = item.bases ? item.bases.floating_bonus : '';
								//保密费
								item.confidentiality_fee = item.bases ? item.bases.confidentiality_fee :
									'';
								//放假补助
								item.free_cost = item.frees ? item.frees.amount : '';
								//补助金
								item.grant = item.costs ? item.costs.grant : '';
								//介绍费
								item.agency_fee = item.costs ? item.costs.agency_fee : '';

								//其它费用(包括奖励和惩罚)	
								let reward_cost = item.costs ? item.costs.reward_cost || 0 : 0;
								let punish_cost = item.costs ? item.costs.punish_cost || 0 : 0;
								let other_cost = item.costs ? item.costs.other_cost || 0 : 0;
								item.other_cost = reward_cost + other_cost - punish_cost;

								//水电费
								item.we_cost = item.wes ? item.wes.share_cost : '';
								//工衣费用
								item.clothes_cost = item.clothes ? item.clothes.clothes_cost : '';
								//上月社保
								item.last_month_sb = item.sbs ? item.sbs.last_month_sb : '';
								//上月社保代扣部份
								item.last_month_dk = item.sbs ? item.sbs.last_month_dk : '';
								//本月社保									
								item.this_month_sb = item.sbs ? item.sbs.this_month_sb : '';
								//本月社保代扣部份									
								item.this_month_dk = item.sbs ? item.sbs.this_month_dk : '';
								//代扣个税
								item.dkgs = item.gss ? item.gss.gs : '';

								//根据定薪表来判断是1:月、2:日、3:时薪，计算工资
								//基本工资、应勤天数、实际出勤
								if (item.salarys.salary_type == 2 || item.salarys.salary_type == 3) {
									item.base_salary = item.total_salary
									item.work_days = 1
								}

								//计算应发工资=综合工资/应勤天数*实际出勤						
								item.gross_salary = vk.pubfn.toDecimal(item.total_salary / item.work_days *
									item.real_days,
									2);

								//计算实发工资
								item.real_salary = item.gross_salary || 0
								item.real_salary += item.overtime_cost || 0
								item.real_salary += item.free_cost || 0
								item.real_salary += item.grant || 0
								item.real_salary += item.agency_fee || 0
								item.real_salary += item.other_cost || 0

								//本月应扣项水电工衣
								item.real_salary -= item.we_cost || 0
								item.real_salary += item.clothes_cost || 0

								//代扣代缴项社保和个税
								item.real_salary -= item.last_month_sb || 0
								item.real_salary -= item.last_month_dk || 0
								item.real_salary -= item.this_month_sb || 0
								item.real_salary -= item.this_month_dk || 0

								item.real_salary -= item.dkgs || 0

								item.real_salary = vk.pubfn.toDecimal(item.real_salary, 2);

								let addRes = await vk.callFunction({
									url: 'admin/hrm/salary/sys/add',
									title: '请求中...',
									data: item,
								});
								if (addRes.code == 0) {
									count++;
								} else {
									count = 0;
									errorRow = JSON.stringify(item);
									break;
								}
							}
						}

						if (count == 0) {
							vk.alert(`错误数据:${errorRow}`, "新增失败", "确定", () => {});
						} else {
							vk.alert(`导入数据:${count}条`, "新增成功", "确定",
								() => {
									this.refresh()
								})
						}
					}
				});
			},
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
									enable_fd2: true
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
									if (nowm !== row.resign_month) {
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
							"valueFormat": "yyyy-MM-dd",

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
						{
							"key": "grant",
							"title": "补助金",
							"type": "number"
						},
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