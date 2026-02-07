/**
 * 自定义公共函数
 */
let myfn = {};
/**
 * 测试函数test1
 * vk.myfn.test1();
 */
myfn.toDate = function(serial) {
	let vk = uni.vk;	
	let utcDate = new Date(Date.UTC(1900, 0, serial - 1));		
	return utcDate.toISOString().slice(0, 10);
};
export default myfn;
