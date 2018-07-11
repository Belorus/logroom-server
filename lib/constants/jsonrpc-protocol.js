const {status, message} = require('./status');

const command = {
	'PUSH_LOG': 'push_log',
	'PUSH_LOGS': 'push_logs',
	'GET_ACTIVE_SESSIONS': 'get_active_sessions',
	'LISTEN_SESSION': 'listen_session',
	'STOP_LISTEN_SESSION': 'stop_listen_session'
};

const commandBack = {
	'PUSH_LOG': 'push_log',
	'PUSH_LOGS': 'push_logs',
	'GET_ACTIVE_SESSIONS': 'get_active_sessions',
	'LISTEN_SESSION': 'listen_session',
	'STOP_LISTEN_SESSION': 'stop_listen_session',
	'PUBLISH_LOGS': 'publish_logs',
	'FIND_SESSION': 'find_session',
	'UNKNOWN_COMMAND': 'unknown_command'
};

module.exports = {
	status,
	message,
	command,
	commandBack
};