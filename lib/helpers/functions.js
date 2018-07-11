exports.getCallerIP = (request) => {
	var ip = request.headers['x-forwarded-for'] ||
		request.connection.remoteAddress ||
		request.socket.remoteAddress ||
		request.connection.socket.remoteAddress;
	ip = ip.split(',')[0];
	ip = ip.split(':').slice(-1);

	return ip;
};

exports.uuid = () => {
	var random, value;
	var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		random = Math.random() * 16 | 0;
		value = (c === 'x') ? random : (random & 0x3 | 0x8);
		return value.toString(16);
	});

	return id;
};