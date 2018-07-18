const Protocol = require('../constants/jsonrpc-protocol');
const LogRoomReject = require('../errors/LogRoomReject');

let JSONRPCResponseBuilder = (() => {
	function cmdEnd(argumentsProvider) {
		var {callback, commandBack, status, result} = argumentsProvider(),
			response = {};

		if(typeof(Protocol.message[status]) === "undefined") {
			response.code = Protocol.status.UNKNOWN_ERROR;
			commandBack = Protocol.commandBack.UNKNOWN_COMMAND;
		} else {
			response.code = status;
		}

		if(typeof(result) !== "undefined") {
			response.result = result;
		}

		response.message = Protocol.message[response.code];

		return callback(commandBack, response);
	}

	function cmdRun(commandBack, action, argumentsProvider) {
		var {callback, cmdArgs, cmdCtx} = argumentsProvider(),
			args = {callback, commandBack};
		action.apply(cmdCtx, cmdArgs)
			.then(response => cmdEnd(() => Object.assign(args, response)))
			.catch(e => {
				if(e instanceof LogRoomReject) {
					return cmdEnd(() => Object.assign(args, {'status': e.status}));
				} else {
					this.logger.error(e.stack);
					return cmdEnd(() => Object.assign(args, {'status': Protocol.status.UNKNOWN_ERROR}));
				}
			});
	}

	class JSONRPCResponseBuilder
	{
		constructor(bus = {}) {
			this.pubSub = bus.PubSub;
			this.eventMashine = bus.EventMashine;
			this.journal = bus.Journal;
			this.session = bus.Session;
			this.monitor = bus.Monitor;
			this.logger = bus.Logger;
			this.events = [];
			this.bindGlobalEvent('active_sessions:sadd', this.monitor.setSessionAsActive);
			this.bindGlobalEvent('publish_logs', this.monitor.publishLogs);
			this.bindGlobalEvent('session_additional_updated', this.monitor.publishSession);
		}

		bindGlobalEvent(event, callback) {
			if(!(
				this.events.indexOf(event) == -1 &&
				typeof(callback) == "function"
			)) {
				return;
			}
			this.events.push(event);
			this.eventMashine.removeAllListeners(event);
			this.eventMashine.on(event, callback);
		}

		build(command, data = {}, callback) {
			function provideCommonArguments(){
				return {callback, cmdArgs, cmdCtx};
			}
			var cmdArgs, cmdCtx;
			switch(command) {
				case Protocol.command.GET_ACTIVE_SESSIONS:
					cmdArgs = [];
					cmdCtx = this.session;
					cmdRun.call(this, Protocol.commandBack.SEND_ACTIVE_SESSIONS, this.session.getActiveSessions, provideCommonArguments);
					break;
				case Protocol.command.LISTEN_SESSION:
					cmdArgs = [data.session_id, logs => cmdEnd(() => ({
						callback,
						'commandBack': Protocol.commandBack.PUBLISH_LOGS,
						'status': Protocol.status.SUCCESS,
						'result': logs
					}))];
					cmdCtx = this.monitor;
					cmdRun.call(this, Protocol.commandBack.LISTEN_SESSION, this.monitor.listenSession, provideCommonArguments);
					break;
				case Protocol.command.STOP_LISTEN_SESSION:
					cmdArgs = [data.session_id];
					cmdCtx = this.monitor;
					cmdRun.call(this, Protocol.commandBack.STOP_LISTEN_SESSION, this.monitor.stopListenSession, provideCommonArguments);
					break;
				case Protocol.command.LISTEN_ACTIVE_SESSIONS:
					cmdArgs = [session => cmdEnd(() => ({
						callback,
						'commandBack': Protocol.commandBack.PUBLISH_SESSION,
						'status': Protocol.status.SUCCESS,
						'result': session
					}))];
					cmdCtx = this.monitor;
					cmdRun.call(this, Protocol.commandBack.LISTEN_ACTIVE_SESSIONS, this.monitor.listenActiveSessions, provideCommonArguments);
					break;
				case Protocol.command.STOP_LISTEN_ACTIVE_SESSIONS:
					cmdArgs = [];
					cmdCtx = this.monitor;
					cmdRun.call(this, Protocol.commandBack.STOP_LISTEN_ACTIVE_SESSIONS, this.monitor.stopListenActiveSessions, provideCommonArguments);
					break;
				case Protocol.command.GET_SESSION_LIST:
					cmdArgs = [data.page, data.filter];
					cmdCtx = this.session;
					cmdRun.call(this, Protocol.commandBack.GET_SESSION_LIST, this.session.getList, provideCommonArguments);
					break;
				case Protocol.command.GET_LOGS_BY_SESSION:
					cmdArgs = [data.session_id, data.page];
					cmdCtx = this.journal;
					cmdRun.call(this, Protocol.commandBack.GET_LOGS_BY_SESSION, this.journal.getLogsBySessionUuid, provideCommonArguments);
					break;
				default:
					cmdEnd(() => Object.assign(provideCommonArguments(), {
						'commandBack': Protocol.commandBack.UNKNOWN_COMMAND,
						'status': Protocol.status.UNKNOWN_COMMAND
					}));
					break;
			}
		}

		getClientCommands() {
			return Object.values(Protocol.command);
		}
	}

	return JSONRPCResponseBuilder;
})();

module.exports = JSONRPCResponseBuilder;