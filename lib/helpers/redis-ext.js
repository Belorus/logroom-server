const redis = require('redis');
const InvalidParam = require('../errors/InvalidParam');

function RedisClient(opts = {}, logger) {
	var config = {
		'host': opts.host || '127.0.0.1',
		'port': opts.port || 6379,
		'connect_timeout': opts.timeout || 3600000
	};
	if(opts.db){
		config.db = opts.db;
	}
	var client=redis.createClient(config);
	function errorLog(err) {
		if(err) {
			logger.error(err.toString());
		}
	}
	client.on('error', errorLog);
	client.on('warning', errorLog);

	client.getKey = (key) => { return new Promise((resolve, reject) => {
		if(!key) {
			return reject(new InvalidParam(`Key can't be an empty`));
		}
		client.get(key, (err, obj) => {
			return err
				? reject(err)
				: resolve(obj);
		});
	}); };

	client.getKeys = async (pattern) => { return new Promise((resolve, reject) => {
		if(!pattern) {
			return reject(new InvalidParam(`Pattern can't be an empty`));
		}
		var keys;
		function composeKeys(err, obj) {
			if(err) {
				return reject(err);
			} else if(!obj) {
				return resolve(null);
			}
			var result = null;
			for(let i=0; i < obj.length; i++){
				if(!(keys[i] && obj[i])) {
					continue;
				} else if(result === null) {
					result = {};
				}
				try {
					result[keys[i]] = JSON.parse(obj[i]);
				} catch (e) {
					return reject(e);
				}
			}

			return resolve(result);
		}
		client.keys(pattern, (err, obj) => {
			if(err) {
				return reject(err);
			} else if(!obj.length){
				return resolve(null);
			}
			keys = obj;
			client.mget(obj, composeKeys);
		});
	}); };

	return client;
}

exports.createRedisClient = (opts, logger) => {
	return new RedisClient(opts, logger);
};