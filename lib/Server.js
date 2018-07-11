const EventEmitter = require('events').EventEmitter;
const DbPool = require('./helpers/db-pool');
const RedisExt = require('./helpers/redis-ext');
const LogRoomPubSub = require('./helpers/pub-sub');
const Journal = require('./Journal');
const Session = require('./Session');
const Monitor = require('./Monitor');
const Logger = require('./Logger');
const JSONRPCResponseBuilder = require('./response/jsonrpc-builder');
const JSONResponseBuilder = require('./response/json-builder');

exports.create = (options) => {
	return new Server(options);
};

let Server = (() => {
	function getModules(PubSub, EventMashine, ConnectionLogger) {
		return {
			'Journal': Journal.create(this.dbhPool, this.redisClient, Session.create(
				this.dbhPool, this.redisClient, EventMashine, ConnectionLogger
			), EventMashine, ConnectionLogger),
			'Monitor': Monitor.create(this.redisClient, PubSub, ConnectionLogger),
			'PubSub': PubSub,
			'EventMashine': EventMashine,
			'Logger': ConnectionLogger
		};
	}

	function initServer(type) {
		if(this.server[type]) {
			return this.server[type];
		}

		this.server[type] = require(`./servers/${type}`).create({
			'createJSONRPCResponseBuilder': (PubSub, EventMashine, ConnectionLogger) =>
				new JSONRPCResponseBuilder(getModules.call(this, PubSub, EventMashine, ConnectionLogger)),
			'createJSONResponseBuilder': (PubSub, EventMashine, ConnectionLogger) =>
				new JSONResponseBuilder(getModules.call(this, PubSub, EventMashine, ConnectionLogger)),
			'getPubSub': (ConnectionLogger) => LogRoomPubSub.create(this.config.redis, ConnectionLogger),
			'getEventMashine': () => new EventEmitter(),
			'getServerLogger': () => this.serverLogger,
			'getConnectionLogger': () => new Logger({'initArgStorage': true}),
			'http': this.config.http
		});
		this.server[type].listen(this.config.listen[type].port, this.config.listen[type].host);

		return this.server[type];
	}

	function closePools() {
		if(this.dbhPool) {
			this.dbhPool.end();
		}
		if(this.sphPool) {
			this.sphPool.end();
		}
		if(this.redisClient) {
			this.redisClient.end(true);
		}
	}

	class Server extends EventEmitter
	{
		constructor(options = {}) {
			super();
			this.serverLogger = new Logger();
			this.config = options.config;
			this.server = {};
			this.dbhPool = DbPool.createPool(this.config.mysql, this.serverLogger);
			this.redisClient = RedisExt.createRedisClient(this.config.redis, this.serverLogger);
			process.on('exit', () => {
				closePools.call(this);
				if(this.server.ws) {
					this.server.ws.emit('close');
				}
				if(this.server.http) {
					this.server.http.emit('close');
				}
				process.exit(1);
			});
			process.on('SIGINT', () => {
				closePools.call(this);
				process.exit(2);
			});
			process.on('uncaughtException', (e) => {
				closePools.call(this);
				this.serverLogger.error(e.stack);
				process.exit(2);
			});
		}

		init_ws() {
			return initServer.call(this, 'ws');
		}

		init_http() {
			return initServer.call(this, 'http');
		}
	}

	return Server;
})();
