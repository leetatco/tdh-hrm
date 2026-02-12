/**
 * 自定义公共函数
 */
var myfn = {};
/**
 * 测试函数test1
 * vk.myfn.test1();
 */
let res = {
	code: 0,
	data: {},
	msg: ''
};

/**
 * 通过身份证号计算年龄
 * @param {str} str 字符串  身份证号
 *
 */
//iden参数是身份证号
function getAgeToIden(iden) {
	let val = iden.length
	let myDate = new Date()
	let month = myDate.getMonth() + 1
	let day = myDate.getDate()
	let age = 0

	if (val === 18) {
		age = myDate.getFullYear() - iden.substring(6, 10) - 1
		if (
			iden.substring(10, 12) < month ||
			(iden.substring(10, 12) == month && iden.substring(12, 14) <= day)
		)
			age++
	}
	return age
}

myfn.test1 = function(card) {
	// 逻辑	  
	let num = card;
	// 身份证号码为15位或者18位，15位时全为数字，18位前17位为数字，最后一位是校验位，可能为数字或字符X。
	if (!/(^\d{15}$)|(^\d{17}([0-9]|X)$)/.test(num)) {
		return false;
	}
	// 校验位按照ISO 7064:1983.MOD 11-2的规定生成，X可以认为是数字10。
	// 下面分别分析出生日期和校验位
	let re;
	let birthday;
	let sex;
	let age;
	let month;
	const len = num.length;

	age = getAgeToIden(num);

	if (len === 15) {
		// 获取出生日期
		birthday = `19${card.substring(6, 8)}-${card.substring(
	          8,
	          10
	        )}-${card.substring(10, 12)}`;
		// 获取性别
		sex = parseInt(card.substr(14, 1), 10) % 2 === 1 ? 'M' : 'F';

		re = new RegExp(/^(\d{6})(\d{2})(\d{2})(\d{2})(\d{3})$/);
		const arrSplit = num.match(re);

		// 检查生日日期是否正确
		const dtmBirth = new Date(
			`19${arrSplit[2]}/${arrSplit[3]}/${arrSplit[4]}`
		);
		const bGoodDay =
			dtmBirth.getFullYear() === Number(arrSplit[2]) &&
			dtmBirth.getMonth() + 1 === Number(arrSplit[3]) &&
			dtmBirth.getDate() === Number(arrSplit[4]);
		if (!bGoodDay) {
			res.code = -1;
			return res;
		}
		// 将15位身份证转成18位
		// 校验位按照ISO 7064:1983.MOD 11-2的规定生成，X可以认为是数字10。
		const arrInt = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
		const arrCh = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
		let nTemp = 0;
		let i;

		num = `${num.substr(0, 6)}19${num.substr(6, num.length - 6)}`;
		for (i = 0; i < 17; i++) {
			nTemp += num.substr(i, 1) * arrInt[i];
		}
		num += arrCh[nTemp % 11];
	} else if (len === 18) {
		//获取出生月份
		month = parseInt(card.substring(
			10,
			12
		));
		// 获取出生日期
		birthday = `${card.substring(6, 10)}-${card.substring(
	          10,
	          12
	        )}-${card.substring(12, 14)}`;
		// 获取性别
		//sex = parseInt(card.substr(16, 1), 10) % 2 === 1 ? 'M' : 'F';

		sex = parseInt(card.substr(16, 1), 10) % 2 === 1 ? 1 : 2;

		re = new RegExp(/^(\d{6})(\d{4})(\d{2})(\d{2})(\d{3})([0-9]|X)$/);
		const arrSplit = num.match(re);

		// 检查生日日期是否正确
		const dtmBirth = new Date(
			`${arrSplit[2]}/${arrSplit[3]}/${arrSplit[4]}`
		);
		dtmBirth.setDate(arrSplit[4]);
		const bGoodDay =
			dtmBirth.getFullYear() === Number(arrSplit[2]) &&
			dtmBirth.getMonth() + 1 === Number(arrSplit[3]) &&
			dtmBirth.getDate() === Number(arrSplit[4]);
		if (!bGoodDay) {
			res.code = -1;
		}
		// 检验18位身份证的校验码是否正确。
		// 校验位按照ISO 7064:1983.MOD 11-2的规定生成，X可以认为是数字10。
		// const arrInt = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
		// const arrCh = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
		// let nTemp = 0;
		// let i;
		// for (i = 0; i < 17; i++) {
		// 	nTemp += num.substr(i, 1) * arrInt[i];
		// }
		// const valnum = arrCh[nTemp % 11];
		// if (valnum !== num.substr(17, 1)) {
		// 	res.code = -1;
		// }
	}

	res.data = {
		birthday,
		month,
		sex,
		age
	};
	// 逻辑	
	console.log(res)
	return res
}

//年末转换，例如：2026.0转2025.12
myfn.normalizeMonth = function(dateStr) {
	const parts = dateStr.split('-');
	if (parts.length < 2) return dateStr;

	const year = parseInt(parts[0]);
	const month = parseInt(parts[1]);

	// 处理月份异常（小于1或大于12）
	if (month < 1 || month > 12) {
		// 创建基准时间（使用当月1日）
		const baseDate = new Date(year, month > 0 ? month - 1 : 0, 1);

		// 使用 getDateInfo 解析基准时间
		const baseInfo = vk.pubfn.getDateInfo(baseDate.getTime());

		// 计算需要调整的月份数
		// 对于月份0，我们需要 -1 个月
		// 对于月份13，我们需要 +12 个月（即1年）
		const monthAdjustment = month - 1;

		// 使用 getOffsetTime 调整时间
		const adjustedTime = vk.pubfn.getOffsetTime(baseDate.getTime(), {
			month: monthAdjustment
		});

		// 获取调整后的日期信息
		const adjustedInfo = vk.pubfn.getDateInfo(adjustedTime);

		// 构建返回字符串
		const formattedMonth = adjustedInfo.month.toString().padStart(2, '0');

		if (parts.length === 2) {
			return `${adjustedInfo.year}-${formattedMonth}`;
		} else {
			// 处理日部分
			const day = parts[2] ? parseInt(parts[2]) : 1;

			// 使用 getOffsetTime 确保日期正确
			const finalTime = vk.pubfn.getOffsetTime(adjustedTime, {
				day: day - 1 // 因为基准是1日，需要调整到指定的日
			});

			const finalInfo = vk.pubfn.getDateInfo(finalTime);
			const formattedDay = finalInfo.day.toString().padStart(2, '0');

			return `${finalInfo.year}-${formattedMonth}-${formattedDay}`;
		}
	}
	return dateStr;
}

//得到已离职人员的备注
myfn.getResignEmployees = async function(card) {
	let res = await vk.callFunction({
		url: 'admin/hrm/employees/sys/getList',
		title: '请求中...',
		data: {
			otherWhereJson: {
				card,
				status: 2
			}
		}
	})
	if (res.code == 0) {
		return res.rows
	}
	return [];
}


//主算入职年限
myfn.calculateServiceYears = function(entryDateStr) {
	// 将字符串转换为Date对象
	const entryDate = new Date(entryDateStr);
	const currentDate = new Date();

	// 计算年份差
	let years = currentDate.getFullYear() - entryDate.getFullYear();
	// 调整：如果还没到入职月份，或者在入职月份但还没到入职日
	const monthDiff = currentDate.getMonth() - entryDate.getMonth();
	const dayDiff = currentDate.getDate() - entryDate.getDate();

	if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
		years--;
	}

	return years;
}


// 批量获取最新员工信息
myfn.batchGetEmployeeInfo = async (cards) => {
	try {
		// 去重
		const uniqueCards = [...new Set(cards)];
		const employeeMap = new Map();
		const res = await vk.callFunction({
			url: 'admin/hrm/employees/pub/getBatchEmployeeInfo',
			title: '获取员工信息中...',
			data: {
				cards: uniqueCards
			}
		});

		if (res.code === 0 && res.data) {
			res.data.forEach(employee => {
				if (employee.card && employee.employee_id) {
					employeeMap.set(employee.card, employee);
				}
			});
		}
		return employeeMap;
	} catch (error) {
		console.error('批量获取员工信息失败:', error);
		return null;
	}
}


export default myfn;