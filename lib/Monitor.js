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

		setSessionAsActive(uuid) {
			if(!uuid) {
				logger.error(`Can't set session as active. uuid is ${uuid}.`);
				return;
			}
			var tm = Math.floor((new Date()).getTime() / ONLINE_PERIOD_MS) * ONLINE_PERIOD,
				key = `active_sessions:${tm}`;
			redisClient.sadd(key, uuid, (err) => {
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