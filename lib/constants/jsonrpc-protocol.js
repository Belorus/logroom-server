const {status, message} = require('./status');

const command = {
	'GET_ACTIVE_SESSIONS': 'get_active_sessions',
	'LISTEN_SESSION': 'listen_session',
	'STOP_LISTEN_SESSION': 'stop_listen_session',
	'LISTEN_ACTIVE_SESSIONS': 'listen_active_sessions',
	'STOP_LISTEN_ACTIVE_SESSIONS': 'stop_listen_active_sessions',
	'GET_SESSION_LIST': 'get_session_list',
	'GET_LOGS_BY_SESSION': 'get_logs_by_session'
};

const commandBack = {
	'SEND_ACTIVE_SESSIONS': 'sendActiveSessions',
	'LISTEN_SESSION': 'listen_session',
	'STOP_LISTEN_SESSION': 'stopLogsObserver',
	'LISTEN_ACTIVE_SESSIONS': 'listen_active_sessions',
	'STOP_LISTEN_ACTIVE_SESSIONS': 'stop_listen_active_sessions',
	'PUBLISH_LOGS': 'sessionLogsObserver',
	'PUBLISH_SESSION': 'publish_session',
	'GET_SESSION_LIST': 'get_session_list',
	'GET_LOGS_BY_SESSION': 'get_logs_by_session',
	'UNKNOWN_COMMAND': 'unknown_command'
};

module.exports = {
	status,
	message,
	command,
	commandBack
};