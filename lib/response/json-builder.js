const Protocol = require('../constants/http-protocol');
const Router = require('http-router');
const LogRoomReject = require('../errors/LogRoomReject');

let HTMLResponseBuilder = (() => {

	var argumentsProvider = (() => {
		class ActionArguments
		{
			constructor(connectionId, body, callback) {
				this._connectionId = connectionId;
				this._body = body;
				this._callback = callback;
			}

			get connectionId() { return this._connectionId; }
			get body() { return this._body; }
			get callback() { return this._callback; }
		}

		var args = {};
		return function(connectionId, body, callback) {
			if(typeof(args[connectionId]) === "undefined") {
				args[connectionId] = new ActionArguments(connectionId, body, callback);
			}

			return args[connectionId];
		};
	})();

	var defineRoutes = (() => {
		var routes;

		return function() {
			if(typeof(routes) !== "undefined") {
				return routes;
			}

			routes = Router.createRouter();
			return routes
				.post(Protocol.urlPath.PUSH_LOG, (reqquest) => { actionPushLog.call(this, reqquest); })
				.post(Protocol.urlPath.PUSH_LOGS, (reqquest) => { actionPushLogs.call(this, reqquest); })
				.get((reqquest) => { actionNotFound.call(this, reqquest); })
				.post((reqquest) => { actionBadRequest.call(this, reqquest); })
				.put((reqquest) => { actionBadRequest.call(this, reqquest); })
				.delete((reqquest) => { actionBadRequest.call(this, reqquest); });
		};
	})();

	function sendResponse(argumentsProvider) {
		var {status, callback} = argumentsProvider(),
			code = typeof(Protocol.message[status]) === "undefined"
				? Protocol.status.UNKNOWN_ERROR
				: status;

		return callback(Protocol.httpStatus[code], JSON.stringify({'message': Protocol.message[code]}));
	}

	function actionNotFound(request = {}) {
		const callback = argumentsProvider(request.connectionId).callback;

		return callback(404, JSON.stringify({'message': 'Not found'}));
	}

	function actionBadRequest(request = {}) {
		const callback = argumentsProvider(request.connectionId).callback;

		return callback(400, JSON.stringify({'message': 'Bad request'}));
	}

	function runAction(actionCtx, actionMethod, actionArgKeys, request = {}) {
		const args = argumentsProvider(request.connectionId);
		var jsonMessage;
		try {
			jsonMessage = JSON.parse(args.body) || {};
		} catch(err) {
			this.logger.error(`Invalid json message ${args.body}`);
			return args.callback(
				Protocol.httpStatus[Protocol.status.INCORRECT_LOG_FORMAT],
				Protocol.message[Protocol.status.INCORRECT_LOG_FORMAT]
			);
		}

		var actionArgs = [];
		for(let i = 0; i < actionArgKeys.length; i++){
			actionArgs.push(jsonMessage[actionArgKeys[i]]);
		}

		return actionMethod.apply(actionCtx, actionArgs)
			.then(response => sendResponse(() => Object.assign(args, response)))
			.catch(e => {
				if(e instanceof LogRoomReject) {
					return sendResponse(() => Object.assign(args, {'status': e.status}));
				} else {
					this.logger.error(e.stack);
					return sendResponse(() => Object.assign(args, {'status': Protocol.status.UNKNOWN_ERROR}));
				}
			});
	}

	function actionPushLog(request) {
		return runAction.call(this, this.journal, this.journal.pushLog, ['session_id', 'seq_number', 'log', 'additional'], request);
	}

	function actionPushLogs(request = {}) {
		return runAction.call(this, this.journal, this.journal.pushLogs, ['session_id', 'seq_number', 'logs', 'additional'], request);
	}

	class HTMLResponseBuilder
	{
		constructor(bus = {}) {
			this.pubSub = bus.PubSub;
			this.eventMashine = bus.EventMashine;
			this.journal = bus.Journal;
			this.monitor = bus.Monitor;
			this.logger = bus.Logger;
			this.routes = defineRoutes.call(this);
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

		build(request, response, body, callback) {
			argumentsProvider(request.connectionId, body, callback);

			return this.routes.route(request, response);
		}
	}

	return HTMLResponseBuilder;
})();

module.exports = HTMLResponseBuilder;