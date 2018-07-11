const LogRoomStatus = require('./constants/status').status;
const LogRoomReject = require('./errors/LogRoomReject');
const Response = require('./response/Response');

let Journal = (() => {
	const CACHE_SEQUENCE_PERIOD = 3600;
	var dbhPool, redisClient, session, eventMashine, logger;

	function checkLogFormat(logMessage) {
		if(typeof(logMessage) !== 'object'){
			logger.error('Incorrect type of log. Log must be an object.');
			return false;
		}
		const format = [
			'categories',
			'level',
			'message',
			'tag',
			'thread',
			'timestamp'
		];
		var result = true, missed = [];
		format.forEach((property) => {
			if(!logMessage.hasOwnProperty(property)) {
				missed.push(property);
				result = false;
			}
		});

		if(!result) {
			logger.error(`Log message has to have properties: ${missed.join(',')}`);
		}

		return result;
	}

	function getSequenceKey(logRoomSessionId){
		return `sequence:${logRoomSessionId}`;
	}

	function isValidSequenceNumber(seqNumber){
		return typeof(seqNumber) === "number";
	}

	async function checkLastSequenceNumber(logRoomSessionId, seqNumber) {
		if(!isValidSequenceNumber(seqNumber)) {
			logger.error(`Incorrect seqNumber: ${seqNumber}`);
			return Promise.reject(new LogRoomReject(LogRoomStatus.INCORRECT_SEQUENCE_NUMBER));
		}

		let currentSequence = await redisClient.getKey(getSequenceKey(logRoomSessionId));

		return currentSequence && currentSequence >= seqNumber
			? Promise.reject(new LogRoomReject(LogRoomStatus.DUPLICATE_SEQUENCE))
			: Promise.resolve(true);
	}

	function updateSequenceNumber(logRoomSessionId, seqNumber) { return new Promise((resolve, reject) => {
		if(!isValidSequenceNumber(seqNumber)) {
			logger.error(`Incorrect seqNumber: ${seqNumber}`);
			return reject(new LogRoomReject(LogRoomStatus.INCORRECT_SEQUENCE_NUMBER));
		}
		var sequenceKey = getSequenceKey(logRoomSessionId);
		redisClient.set(getSequenceKey(logRoomSessionId), seqNumber, (err) => {
			if(err) {
				return reject(err);
			}
			redisClient.expire(sequenceKey, CACHE_SEQUENCE_PERIOD);
			return resolve(true);
		});
	}); }

	function saveLogsToDb(logRoomSessionId, seqNumber, logsList) { return new Promise((resolve, reject) => {
		dbhPool.getConnection((err, conn) => {
			if(err) {
				conn.release();
				logger.error('Can\'t get MySQL connection...');
				return reject(new LogRoomReject(LogRoomStatus.DB_CONNECTION_FAILED));
			}
			conn.query(`
INSERT INTO journal(session_id, log)
VALUES ${logsList.map((logMessage) =>`(${conn.escape(logRoomSessionId)}, ${conn.escape(JSON.stringify(logMessage))})`).join(',')}
			`, (err, result) => {
				conn.release();
				if(err || !result.insertId) {
					logger.error(`Can't insert logs into journal table. Err: ${err}, result: ${result}`);
					return reject(new LogRoomReject(LogRoomStatus.DB_QUERY_FAILED));
				}

				return updateSequenceNumber(logRoomSessionId, seqNumber)
					.then(() => resolve(true))
					.catch(e => reject(e))
			});
		});
	}); }

	class Journal
	{
		constructor(/* dbhPool, redisClient, session, eventMashine, logger */) {
			dbhPool = arguments[0];
			redisClient = arguments[1];
			session = arguments[2];
			eventMashine = arguments[3];
			logger = arguments[4];
		}

		async pushLog(sessionId, seqNumber, logMessage, additional) {
			return this.pushLogs(sessionId, seqNumber, [logMessage], additional)
				.then(() => Promise.resolve(new Response(LogRoomStatus.LOG_SUCCESSFUL_PUSHED)))
				.catch(e => {
					if(e instanceof LogRoomReject) {
						return Promise.reject(e);
					} else {
						logger.error(e.stack);
						return Promise.reject(new LogRoomReject(LogRoomStatus.UNKNOWN_ERROR));
					}
				});
		}

		async pushLogs(sessionId, seqNumber, logMessages, additional) {
			const logRoomSessionId = await session.getLogRoomSessionId(sessionId, additional);
			logger.setArguments({sessionId});

			await checkLastSequenceNumber(logRoomSessionId, seqNumber);

			if(!(Array.isArray(logMessages) && logMessages.length)){
				logger.error('Logs list must be sent as not empty array');
				return Promise.reject(new LogRoomReject(LogRoomStatus.INCORRECT_LOGS_LIST));
			}

			var logsList = [];
			for(let i = 0; i < logMessages.length; i++) {
				if(!checkLogFormat(logMessages[i])) {
					return Promise.reject(new LogRoomReject(LogRoomStatus.INCORRECT_LOG_FORMAT));
				}
				logsList.push(logMessages[i]);
			}

			await saveLogsToDb(logRoomSessionId, seqNumber, logsList);

			eventMashine.emit('active_sessions:sadd', sessionId);
			eventMashine.emit('publish_logs', {sessionId, 'logs': logsList});

			return Promise.resolve(new Response(LogRoomStatus.LOGS_SUCCESSFUL_PUSHED));
		}
	}

	return Journal;
})();

exports.create = (dbhPool, redisClient, session, eventMashine, logger) => {
	return new Journal(dbhPool, redisClient, session, eventMashine, logger);
};