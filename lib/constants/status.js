const status = {
	'LOG_SUCCESSFUL_PUSHED': 1000,
	'LOGS_SUCCESSFUL_PUSHED': 1001,
	'SUCCESS': 1002,
	'UNKNOWN_COMMAND': 2000,
	'DB_CONNECTION_FAILED': 2001,
	'DB_QUERY_FAILED': 2002,
	'INCORRECT_LOGS_LIST': 2003,
	'INCORRECT_LOG_FORMAT': 2004,
	'INCORRECT_SESSION_ID': 2005,
	'INCORRECT_SEQUENCE_NUMBER': 2006,
	'DUPLICATE_SEQUENCE': 2007,
	'CREATE_SESSION_ERROR': 2008,
	'UPDATE_SESSION_FAILED': 2009,
	'INCORRECT_FILTER': 2010,
	'INCORRECT_PAGE': 2011,
	'UNKNOWN_ERROR': 0
};

const message = {
	[status.LOG_SUCCESSFUL_PUSHED]: 'Log was successfully saved',
	[status.LOGS_SUCCESSFUL_PUSHED]: 'Logs were successfully added',
	[status.SUCCESS]: 'Ok',
	[status.UNKNOWN_COMMAND]: 'Unknown command',
	[status.UNKNOWN_ERROR]: 'Unknown error',
	[status.DB_CONNECTION_FAILED]: 'DB Connection failed',
	[status.DB_QUERY_FAILED]: 'DB Query failed',
	[status.INCORRECT_LOG_FORMAT]: 'Incorrect log format',
	[status.INCORRECT_LOGS_LIST]: 'Incorrect logs list sended',
	[status.INCORRECT_SESSION_ID]: 'Incorrect session_id',
	[status.INCORRECT_SEQUENCE_NUMBER]: 'Incorrect seq_number',
	[status.DUPLICATE_SEQUENCE]: 'Logs with this sequence number were already saved',
	[status.CREATE_SESSION_ERROR]: "Can't create a new session",
	[status.UPDATE_SESSION_FAILED]: "Can't update session",
	[status.INCORRECT_FILTER]: "Incorrect filter",
	[status.INCORRECT_PAGE]: "Incorrect page"
};

module.exports = {
	status,
	message
};