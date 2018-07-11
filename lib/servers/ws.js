const Events = require('events');
const WebSocketServer = require('ws').Server;
const http = require('http');
const {uuid, getCallerIP} = require('../helpers/functions');

class Server extends Events.EventEmitter
{
	constructor(/* options, listener */) {
		super();

		var options;

		if (typeof arguments[0] == 'function') {
			options = {};
			this.on('connection', arguments[0]);
		} else {
			options = arguments[0] || {};

			if (typeof arguments[1] == 'function') {
				this.on('connection', arguments[1]);
			}
		}
		this.logger = options.getServerLogger();
		this.connectionCount = 0;
		this.server = http.createServer((request, response) => {
			this.logger.note(`Received request for ${request.url}`);
			response.writeHead(404);
			response.end();
		});
		var wsServer=new WebSocketServer({
			'server': this.server
		});

		wsServer.on('connection', (connection, request) => {
			let connectionId = uuid(),
				ip = getCallerIP(request);
			connection.send(connection.id = connectionId);
			++this.connectionCount;
			var ConnectionLogger = options.getConnectionLogger(),
				PubSub = options.getPubSub(ConnectionLogger),
				EventMashine = options.getEventMashine(),
				ResponseBuilder = options.createJSONRPCResponseBuilder(PubSub, EventMashine, ConnectionLogger);

			ConnectionLogger.setArguments({connectionId, ip});

			connection.on('message', (message) => {
				var action;
				try {
					action = JSON.parse(message);
				} catch(err){
					connection.send(err);
					return;
				}
				ResponseBuilder.build(action, (result) => {
					result.id = connectionId;
					connection.send(JSON.stringify(result));
				});
			});
			connection.on('close', () => {
				PubSub.punsubscribe();
				ConnectionLogger.note('Peer disconnected');
			});
			ConnectionLogger.note('Peer connected');
		});

		this.server.on('error', (e) => {
			if (e.code == 'EADDRINUSE') {
				this.logger.error(`server error, address already in use: ${e}`);
			} else {
				this.logger.error(`server error: ${e}`);
			}
		});

		this.server.on('close', () => {
			this.logger.note(`LogRoom server closing after handling ${this.connectionCount} connections`);
		});

		this.on('close', () => {
			this.server.emit('close');
		});
	}

	listen(port, host, callback) {
		this.logger.note(`LogRoom server binding to port ${port} on ${host || 'all IPs'} ...`);
		this.server.listen(port, host, () => {
			this.logger.note("successfully bound!");
			if(typeof(callback) == 'function') {
				callback.call(this);
			}
		});
	}
}

exports.create = function() {
	return new Server(arguments[0], arguments[1]);
};