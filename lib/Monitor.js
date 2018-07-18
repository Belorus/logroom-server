const Underscore = require('underscore');
const LogRoomStatus = require('./constants/status').status;
const Response = require('./response/Response');
const InvalidParam = require('./errors/InvalidParam');

let Monitor = (() => {
	const ONLINE_PERIOD = 300;
	var redisClient, pubSub, logger;

	class Monitor
	{
		constructor(/* redisClient, pubSub, logger */) {
			redisClient = arguments[0];
			pubSub = arguments[1];
			logger = arguments[2];
		}

		setSessionAsActive(uuid) {
			if(!uuid) {
				logger.error(`Can't set session as active. uuid is ${uuid}.`);
				return;
			}
			var key = `online_session:${uuid}`;
			redisClient.set(key, '', (err) => {
				if(!err) {
					redisClient.expire(key, ONLINE_PERIOD);
				}
			});
		}

		publishLogs(msg = {}) {
			pubSub.sendMsg(`session:${msg.uuid}`, msg.logs);
		}

		publishSession(session) {
			pubSub.sendMsg('active_sessions', session);
		}

		getActiveUuidList() { return new Promise((resolve, reject) => {
			var list = [];
			redisClient.keys('online_session:*', (err, keys) => {
				if(err) {
					return reject(err);
				}
				for(let i = 0; i < keys.length; i++){
					list.push(keys[i].split(':').pop());
				}

				return resolve(list);
			});
		}); }

		async listenSession(uuid, callback) {
			if(!(uuid && typeof(callback) == "function")) {
				return Promise.reject(new InvalidParam(`Can't listen session uuid: ${uuid}`));
			}
			pubSub.subscribe(`session:${uuid}`, (logs) => {
				callback.call(this, logs, true);
			});
			return Promise.resolve(new Response(LogRoomStatus.SUCCESS));
		}

		async stopListenSession(uuid) {
			if(!uuid) {
				return Promise.reject(new InvalidParam(`Can't stop listen session uuid: ${uuid}`));
			}
			pubSub.unsubscribe(`session:${uuid}`);
			return Promise.resolve(new Response(LogRoomStatus.SUCCESS));
		}

		async listenActiveSessions(callback) {
			pubSub.subscribe('active_sessions', (session) => {
				callback.call(this, session, true);
			});
			return Promise.resolve(new Response(LogRoomStatus.SUCCESS));
		}

		async stopListenActiveSessions() {
			pubSub.unsubscribe('active_sessions');
			return Promise.resolve(new Response(LogRoomStatus.SUCCESS));
		}
	}

	return Monitor;
})();

exports.create = (redisClient, pubSub, logger) => {
	return new Monitor(redisClient, pubSub, logger);
};