const LogRoomStatus = require('./constants/status').status;
const LogRoomReject = require('./errors/LogRoomReject');
const InvalidParam = require('./errors/InvalidParam');

let Session = (() => {
	const CACHE_SESSION_PERIOD = 3600;
	var dbhPool, redisClient, eventMashine, logger;

	function getSessionKey(sessionId){
		return `session:${sessionId}`;
	}

	function canUpdateSession(logRoomSessionId, additional = {}) {
		if(typeof(additional) !== "object") {
			additional = {};
		}

		return logRoomSessionId && Object.keys(additional).length !== 0;
	}

	function updateAdditional(conn, logRoomSessionId, additional = {}){ return new Promise((resolve, reject) => {
		if(!canUpdateSession(logRoomSessionId, additional)) {
			return reject(new InvalidParam(`Can't update additional. logRoomSessionId: ${logRoomSessionId}`));
		}

		var jsonInsertStatement = ['data'];
		for(let k in additional) {
			if(additional.hasOwnProperty(k)){
				jsonInsertStatement.push(`${conn.escape(`$."${k}"`)}`, `CAST(${conn.escape(JSON.stringify(additional[k]))} AS JSON)`);
			}
		}
		conn.query(`
UPDATE session
SET
	data = JSON_INSERT(${jsonInsertStatement.join(',')})
WHERE
	id = ${conn.escape(logRoomSessionId)}
		`, (err) => {
			if(err) {
				conn.release();
				logger.error(err);
				return reject(new LogRoomReject(LogRoomStatus.UPDATE_SESSION_FAILED));
			}

			return resolve(logRoomSessionId);
		});
	}); }

	async function getLogRoomSessionIdFromRedis(sessionId, additional = {}) {
		let logRoomSessionId = await redisClient.getKey(getSessionKey(sessionId));

		if(canUpdateSession(logRoomSessionId, additional)){
			await this.updateSession(logRoomSessionId, additional);
		}

		return Promise.resolve(logRoomSessionId);
	}

	function getLogRoomSessionIdFromDb(sessionId, additional = {}) { return new Promise((resolve, reject) => {
		if(!sessionId) {
			return reject(new InvalidParam(`Invalid sessionId: ${sessionId}`));
		}

		if(typeof(additional) !== "object") {
			additional = {};
		}

		dbhPool.getConnection((err, conn) => {
			if(err) {
				conn.release();
				logger.error('Can\'t get MySQL connection...');
				return reject(new LogRoomReject(LogRoomStatus.DB_CONNECTION_FAILED));
			}

			function updateSession(logRoomSessionId){
				updateAdditional(conn, logRoomSessionId, additional)
					.then(logRoomSessionId => resolve(logRoomSessionId))
					.catch(e => reject(e));
			}

			function cacheAndBackLogRoomSessionId(logRoomSessionId) {
				const sessionKey = getSessionKey(sessionId);
				redisClient.set(sessionKey, logRoomSessionId, (err) => {
					if(!err){
						redisClient.expire(sessionKey, CACHE_SESSION_PERIOD);
					}
				});

				return canUpdateSession(logRoomSessionId, additional)
					? updateSession(logRoomSessionId)
					: resolve(logRoomSessionId);
			}

			function getSessionId() {
				conn.query(`SELECT id FROM session where uuid = ${conn.escape(sessionId)} LIMIT 1`, getSessionIdCallback);
			}

			function getSessionIdCallback(err, rows) {
				if(err) {
					conn.release();
					return reject(err);
				}
				return rows.length === 0
					? steps.shift().call(this)
					: cacheAndBackLogRoomSessionId(rows[0].id, additional);
			}

			var steps = [
				() => getSessionId(),
				() => {
					conn.query(`
INSERT IGNORE INTO session
SET
	uuid = ${conn.escape(sessionId)},
	data = ${conn.escape(JSON.stringify(additional))}
					`, (steps.shift()));
				},
				(err, result) => {
					conn.release();
					if(err) {
						logger.error(`Can't insert session into session table. Err: ${err}, result: ${result}`);
						return reject(new LogRoomReject(LogRoomStatus.DB_QUERY_FAILED));
					}

					return result.insertId
						? cacheAndBackLogRoomSessionId(result.insertId)
						: getSessionId()
				},
				() => {
					return reject(new LogRoomReject(LogRoomStatus.CREATE_SESSION_ERROR));
				}
			];

			return steps.shift().apply(this);
		});
	}); }

	class Session
	{
		constructor(/* dbhPool, redisClient, eventMashine, logger */) {
			dbhPool = arguments[0];
			redisClient = arguments[1];
			eventMashine = arguments[2];
			logger = arguments[3];
		}

		async getLogRoomSessionId(sessionId, additional) {
			if (["number", "string"].indexOf(typeof(sessionId)) === -1 || sessionId === 0 || sessionId === "") {
				logger.error(`Incorrect session_id: ${sessionId}`);
				return Promise.reject(new LogRoomReject(LogRoomStatus.INCORRECT_SESSION_ID));
			}
			let logRoomSessionId = await getLogRoomSessionIdFromRedis.call(this, sessionId, additional);

			return logRoomSessionId
				? Promise.resolve(logRoomSessionId)
				: Promise.resolve(await getLogRoomSessionIdFromDb(sessionId, additional));
		}

		updateSession(logRoomSessionId, additional = {}){ return new Promise((resolve, reject) => {
			if(!canUpdateSession(logRoomSessionId, additional)) {
				return reject(new InvalidParam(`Can't update additional. logRoomSessionId: ${logRoomSessionId}`));
			}

			dbhPool.getConnection((err, conn) => {
				if(err) {
					conn.release();
					logger.error('Can\'t get MySQL connection...');
					return reject(new LogRoomReject(LogRoomStatus.DB_CONNECTION_FAILED));
				}

				updateAdditional(conn, logRoomSessionId, additional)
					.then(logRoomSessionId => resolve(logRoomSessionId))
					.catch(e => reject(e));
			});
		}); }
	}

	return Session;
})();

exports.create = (dbhPool, redisClient, eventMashine, logger) => {
	return new Session(dbhPool, redisClient, eventMashine, logger);
};