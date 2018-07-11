const Protocol = require('../constants/jsonrpc-protocol');
const LogRoomReject = require('../errors/LogRoomReject');

let JSONRPCResponseBuilder = (() => {
	function cmdEnd(argumentsProvider) {
		var {callback, command, status, result, remoteCallback} = argumentsProvider(),
			response = {};

		if(typeof(remoteCallback) === "string") {
			response.callback = remoteCallback;
		}

		if(typeof(Protocol.message[status]) === "undefined") {
			response.code = Protocol.status.UNKNOWN_ERROR;
			command = Protocol.commandBack.UNKNOWN_COMMAND;
		} else {
			response.code = status;
		}

		if(typeof(result) !== "undefined") {
			response.result = result;
		}

		response.message = Protocol.message[response.code];

		return callback({'command': command, 'data': response});
	}

	function cmdRun(command, action, argumentsProvider) {
		var {callback, cmdArgs, cmdCtx, remoteCallback} = argumentsProvider(),
			args = {callback, command, remoteCallback};
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
			this.monitor = bus.Monitor;
			this.logger = bus.Logger;
			this.events = [];
			this.bindGlobalEvent('active_sessions:sadd', this.monitor.setSessionAsActive);
			this.bindGlobalEvent('publish_logs', this.monitor.publishLogs);
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

		build(message = {}, callback) {
			function provideCommonArguments(){
				return {callback, cmdArgs, cmdCtx, remoteCallback};
			}
			var data = message.data || {},
				remoteCallback = data.callback,
				cmdArgs, cmdCtx;
			switch(message.command) {
				case Protocol.command.PUSH_LOG:
					cmdArgs = [data.session_id, data.seq_number, data.log, data.additional];
					cmdCtx = this.journal;
					cmdRun.call(this, Protocol.commandBack.PUSH_LOG, this.journal.pushLog, provideCommonArguments);
					break;
				case Protocol.command.PUSH_LOGS:
					cmdArgs = [data.session_id, data.seq_number, data.logs, data.additional];
					cmdCtx = this.journal;
					cmdRun.call(this, Protocol.commandBack.PUSH_LOGS, this.journal.pushLogs, provideCommonArguments);
					break;
				case Protocol.command.GET_ACTIVE_SESSIONS:
					cmdArgs = [];
					cmdCtx = this.monitor;
					cmdRun.call(this, Protocol.commandBack.GET_ACTIVE_SESSIONS, this.monitor.getActiveSessions, provideCommonArguments);
					break;
				case Protocol.command.LISTEN_SESSION:
					cmdArgs = [data.session_id, logs => cmdEnd(() => ({
						callback,
						'command': Protocol.commandBack.PUBLISH_LOGS,
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
				default:
					cmdEnd(() => Object.assign(provideCommonArguments(), {
						'command': Protocol.commandBack.UNKNOWN_COMMAND,
						'status': Protocol.status.UNKNOWN_COMMAND
					}));
					break;
			}
		}
	}

	return JSONRPCResponseBuilder;
})();

module.exports = JSONRPCResponseBuilder;