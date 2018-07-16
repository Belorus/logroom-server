const LogRoomStatus = require('./constants/status').status;
const LogRoomReject = require('./errors/LogRoomReject');
const InvalidParam = require('./errors/InvalidParam');
const Response = require('./response/Response');

let Session = (() => {
	const CACHE_SESSION_PERIOD = 3600;
	const SESSIONS_PAGE_LIMIT = 250;
	var dbhPool, redisClient, eventMashine, logger;

	function getSessionKey(uuid){
		return `session:${uuid}`;
	}

	function canUpdateSession(logRoomSessionId, additional = {}) {
		if(typeof(additional) !== "object") {
			additional = {};
		}

		return logRoomSessionId && Object.keys(additional).length !== 0;
	}

	function updateAdditional(conn, logRoomSessionId, uuid, additional = {}){ return new Promise((resolve, reject) => {
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
				logger.error(err);
				return reject(new LogRoomReject(LogRoomStatus.UPDATE_SESSION_FAILED));
			}

			eventMashine.emit('session_additional_updated', {uuid, additional});

			return resolve(logRoomSessionId);
		});
	}); }

	async function getLogRoomSessionIdFromRedis(uuid, additional = {}) {
		let logRoomSessionId = await redisClient.getKey(getSessionKey(uuid));

		if(canUpdateSession(logRoomSessionId, additional)){
			await this.update(logRoomSessionId, uuid, additional);
		}

		return Promise.resolve(logRoomSessionId);
	}

	function getLogRoomSessionIdFromDb(uuid, additional = {}) { return new Promise((resolve, reject) => {
		if(!uuid) {
			return reject(new InvalidParam(`Invalid uuid: ${uuid}`));
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
				updateAdditional(conn, logRoomSessionId, uuid, additional)
					.then(logRoomSessionId => {
						return resolve(logRoomSessionId), conn.release();
					})
					.catch(e => {
						return reject(e), conn.release();
					});
			}

			function cacheAndBackLogRoomSessionId(logRoomSessionId) {
				const sessionKey = getSessionKey(uuid);
				redisClient.set(sessionKey, logRoomSessionId, (err) => {
					if(!err){
						redisClient.expire(sessionKey, CACHE_SESSION_PERIOD);
					}
				});

				return canUpdateSession(logRoomSessionId, additional)
					? updateSession(logRoomSessionId)
					: resolve(logRoomSessionId) && conn.release();
			}

			function getSessionId() {
				conn.query(`SELECT id FROM session where uuid = ${conn.escape(uuid)} LIMIT 1`, getSessionIdCallback);
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
	uuid = ${conn.escape(uuid)},
	data = ${conn.escape(JSON.stringify(additional))}
					`, (steps.shift()));
				},
				(err, result) => {
					if(err) {
						conn.release();
						logger.error(`Can't insert session into session table. Err: ${err}, result: ${result}`);
						return reject(new LogRoomReject(LogRoomStatus.DB_QUERY_FAILED));
					}

					return result.insertId
						? cacheAndBackLogRoomSessionId(result.insertId)
						: getSessionId()
				},
				() => {
					conn.release();
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

		async getLogRoomSessionId(uuid, additional) {
			if (["number", "string"].indexOf(typeof(uuid)) === -1 || uuid === 0 || uuid === "") {
				logger.error(`Incorrect session_id: ${uuid}`);
				return Promise.reject(new LogRoomReject(LogRoomStatus.INCORRECT_SESSION_ID));
			}

			let logRoomSessionId = await getLogRoomSessionIdFromRedis.call(this, uuid, additional);

			return logRoomSessionId
				? Promise.resolve(logRoomSessionId)
				: Promise.resolve(await getLogRoomSessionIdFromDb(uuid, additional));
		}

		update(logRoomSessionId, uuid, additional = {}){ return new Promise((resolve, reject) => {
			if(!canUpdateSession(logRoomSessionId, additional)) {
				return reject(new InvalidParam(`Can't update additional. logRoomSessionId: ${logRoomSessionId}`));
			}

			dbhPool.getConnection((err, conn) => {
				if(err) {
					conn.release();
					logger.error('Can\'t get MySQL connection...');
					return reject(new LogRoomReject(LogRoomStatus.DB_CONNECTION_FAILED));
				}

				updateAdditional(conn, logRoomSessionId, uuid, additional)
					.then(logRoomSessionId => {
						return resolve(logRoomSessionId), conn.release();
					})
					.catch(e => {
						return reject(e), conn.release();
					});
			});
		}); }

		getList(page = 1, filter = {}) { return new Promise((resolve, reject) => {
			if(!(typeof(page) === "number" && page > 0)) {
				return reject(new LogRoomReject(LogRoomStatus.INCORRECT_PAGE));
			}
			if(typeof(filter) !== "object") {
				return reject(new LogRoomReject(LogRoomStatus.INCORRECT_FILTER));
			}
			dbhPool.getConnection((err, conn) => {
				if(err) {
					conn.release();
					logger.error('Can\'t get MySQL connection...');
					return reject(new LogRoomReject(LogRoomStatus.DB_CONNECTION_FAILED));
				}
				var response = {'total': 0, 'list': []}, whereStatement = [1], steps = [
					() => {
						for(let k in filter) {
							if(filter.hasOwnProperty(k)){
								whereStatement.push(`data ->> ${conn.escape(`$."${k}"`)} = ${conn.escape(JSON.stringify(filter[k]))}`);
							}
						}
						whereStatement = whereStatement.join(' AND ');
						steps.shift().call(this);
					},
					() => {
						conn.query(`SELECT COUNT(id) as count FROM session WHERE ${whereStatement}`, (steps.shift()));
					},
					(err, rows) => {
						if(err) {
							conn.release();
							return reject(err);
						}

						return rows[0].count > 0
							? (response.total = rows[0].count) && steps.shift().call(this)
							: resolve(new Response(LogRoomStatus.SUCCESS, response)) && conn.release();
					},
					() => {
						conn.query(`
SELECT
	uuid,
	data as additional
FROM session
WHERE ${whereStatement}
ORDER BY id DESC
LIMIT ${page * SESSIONS_PAGE_LIMIT - SESSIONS_PAGE_LIMIT}, ${SESSIONS_PAGE_LIMIT}
						`, (steps.shift()));
					},
					(err, rows) => {
						conn.release();
						if(err) {
							return reject(err);
						}
						response.list = rows;
						return resolve(new Response(LogRoomStatus.SUCCESS, response));
					}
				];

				return steps.shift().apply(this);
			});
		}); }
	}

	return Session;
})();

exports.create = (dbhPool, redisClient, eventMashine, logger) => {
	return new Session(dbhPool, redisClient, eventMashine, logger);
};