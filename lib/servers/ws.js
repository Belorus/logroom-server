const Events = require('events');
const io = require('socket.io');
const http = require('http');

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

		let socketOptions = {
			"pingInterval": 25000,
			"pingTimeout": 60000
		};

		var socket = io.listen(this.server, socketOptions);

		socket.on('connection', (connection) => {
			let connectionId = connection.id,
				ip = connection.handshake.address;
			++this.connectionCount;
			var ConnectionLogger = options.getConnectionLogger(),
				PubSub = options.getPubSub(ConnectionLogger),
				EventMashine = options.getEventMashine(),
				ResponseBuilder = options.createJSONRPCResponseBuilder(PubSub, EventMashine, ConnectionLogger);

			ConnectionLogger.setArguments({connectionId, ip, 'request': connection.handshake});

			ResponseBuilder.getClientCommands().map((command) => {
				connection.on(command, (data) => {
					let tmStart = Date.now();
					ResponseBuilder.build(command, data, (commandBack, result) => {
						connection.emit(commandBack, result);
						if(typeof(tmStart) !== "undefined") {
							ConnectionLogger.note({command, commandBack, 'tm': ((Date.now() - tmStart) / 1000).toFixed(4)});
							tmStart = undefined;
						}
					});
				});
			});

			connection.on('disconnect', () => {
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