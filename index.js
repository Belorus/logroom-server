const Server = require('./lib/Server');
const Config = require('./lib/Config');

exports.getInstance = (options) => {
	return Server.create({
		config: new Config(options)
	});
};