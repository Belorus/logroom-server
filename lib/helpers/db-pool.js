const Mysql = require('mysql');

function DbPool(opts = {}, logger) {
	var config = {
		host: opts.host || 'localhost',
		port: opts.port || 3306,
		database: opts.db || 'test',
		user: opts.user || 'test',
		password: opts.secret || '',
		charset: 'UTF8_GENERAL_CI',
		timezone: 'UTC',
		supportBigNumbers: true,
		multipleStatements: true,
		useTZ: typeof(opts.useTZ) === "undefined" ? true : opts.useTZ,
		timeOut: typeof(opts.timeout) === "undefined" ? 1 : opts.timeout,
		debug: false
	};
	var pool = Mysql.createPool(config);
	var initStatement = ['SET NAMES utf8'], initValues = [];
	if(config.timeOut > 0){
		initStatement.push('SESSION wait_timeout=?');
		initValues.push(config.timeOut);
	}
	if(config.useTZ) {
		initStatement.push('SESSION time_zone=?');
		initValues.push(config.timezone);
	}
	pool.on('connection', (dbh) => {
		dbh.query(initStatement.join(','), initValues, (err) => {
			if(err) {
				logger.error(err);
			}
		});
	});
	function errorLog(err) {
		if(err) {
			logger.error(err.toString());
		}
	}
	pool.on('error', errorLog);
	pool.on('warning', errorLog);
	pool.escapeString = (str) => {
		var specials = ['\\','(',')','|','-','!','@','~','"','&','/','^','$','='];
		var regex = RegExp('[' + specials.join('\\') + ']', 'g');
		return str.toString().replace(regex, "\\\\$&");
	};

	return pool;
}

exports.createPool = (opts, logger) => {
	return new DbPool(opts, logger);
};