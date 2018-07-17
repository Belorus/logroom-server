const {status, message} = require('./status');

const httpStatus = {
	[status.SUCCESS]: 200,
	[status.LOG_SUCCESSFUL_PUSHED]: 201,
	[status.LOGS_SUCCESSFUL_PUSHED]: 201,
	[status.UNKNOWN_COMMAND]: 400,
	[status.DB_CONNECTION_FAILED]: 500,
	[status.DB_QUERY_FAILED]: 500,
	[status.UNKNOWN_ERROR]: 520,
	[status.INCORRECT_LOG_FORMAT]: 400,
	[status.INCORRECT_LOGS_LIST]: 400,
	[status.INCORRECT_SESSION_ID]: 400,
	[status.INCORRECT_SEQUENCE_NUMBER]: 400,
	[status.DUPLICATE_SEQUENCE]: 200,
	[status.CREATE_SESSION_ERROR]: 500,
	[status.UPDATE_SESSION_FAILED]: 500
};

const urlPath = {
	'PUSH_LOG': '/push_log',
	'PUSH_LOGS': '/push_logs'
};

module.exports = {
	status,
	message,
	httpStatus,
	urlPath
};