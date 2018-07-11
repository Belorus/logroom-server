const Underscore = require('underscore');
const LogRoomStatus = require('./constants/status').status;
const Response = require('./response/Response');
const InvalidParam = require('./errors/InvalidParam');

let Monitor = (() => {
	const ONLINE_PERIOD = 300;
	const ONLINE_PERIOD_MS = ONLINE_PERIOD * 1000;
	var redisClient, pubSub, logger;

	class Monitor
	{
		constructor(/* redisClient, pubSub, logger */) {
			redisClient = arguments[0];
			pubSub = arguments[1];
			logger = arguments[2];
		}

		setSessionAsActive(sessionId) {
			if(!sessionId) {
				logger.error(`Can't set session as active. sessionId is ${sessionId}.`);
				return;
			}
			var tm = Math.floor((new Date()).getTime() / ONLINE_PERIOD_MS) * ONLINE_PERIOD,
				key = `active_sessions:${tm}`;
			redisClient.sadd(key, sessionId, (err) => {
				if(!err) {
					redisClient.expire(key, ONLINE_PERIOD);
				}
			});
		}

		publishLogs(msg = {}) {
			pubSub.sendMsg(`session:${msg.sessionId}`, msg.logs);
		}

		getActiveSessions() { return new Promise((resolve, reject) => {
			var list = [], addToList = (set) => { return () => {
				redisClient.smembers(set, (steps.shift()));
			}; }, addToListCallback = (err, members) => {
				if(!err && members) {
					list = list.concat(members);
					list = Underscore.unique(list);
				}
				if(steps.length === 1) {
					steps.shift().call(this);
				}
			}, steps = [];

			redisClient.keys('active_sessions:*', (err, keys) => {
				if(err) {
					return reject(err);
				} else if(!keys.length) {
					return resolve(new Response(LogRoomStatus.SUCCESS, []));
				}

				for(let i = 0; i < keys.length; i++){
					steps.push(addToList(keys[i]), addToListCallback);
				}
				steps.push(() => resolve(new Response(LogRoomStatus.SUCCESS, list)));
				return steps.shift().call(this);
			});
		}); }

		async listenSession(sessionId, callback) {
			if(!(sessionId && typeof(callback) == "function")) {
				return Promise.reject(new InvalidParam(`Can't listen session sessionId: ${sessionId}`));
			}
			pubSub.subscribe(`session:${sessionId}`, (logs) => {
				callback.call(this, logs, true);
			});
			return Promise.resolve(new Response(LogRoomStatus.SUCCESS));
		}

		async stopListenSession(sessionId) {
			if(!sessionId) {
				return Promise.reject(new InvalidParam(`Can't stop listen session sessionId: ${sessionId}`));
			}
			pubSub.unsubscribe(`session:${sessionId}`);
			return Promise.resolve(new Response(LogRoomStatus.SUCCESS));
		}
	}

	return Monitor;
})();

exports.create = (redisClient, pubSub, logger) => {
	return new Monitor(redisClient, pubSub, logger);
};