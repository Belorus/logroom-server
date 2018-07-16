const Events = require('events');
const http = require('http');
const {uuid, getCallerIP} = require('../helpers/functions');

class Server extends Events.EventEmitter
{
	constructor(/* options, listener */) {
		super();

		var options = {};
		if (typeof arguments[0] == 'function') {
			this.on('connection', arguments[0]);
		} else {
			options = arguments[0] || {};

			if (typeof arguments[1] == 'function') {
				this.on('connection', arguments[1]);
			}
		}

		var baseHeaders = {
			"Access-Control-Allow-Origin": options.http.access_control_allow_origin,
			"Access-Control-Allow-Headers": "Content-Type, Content-Length, X-Requested-With, Accept",
			"Content-Type": "application/json; charset=utf-8"
		};

		this.logger = options.getServerLogger();
		this.connectionCount = 0;
		this.server = http.createServer();

		this.server.on('request', (request, response) => {
			let connectionId = uuid(),
				ip = getCallerIP(request);
			var ConnectionLogger = options.getConnectionLogger();
			++this.connectionCount;
			request.connectionId = connectionId;

			ConnectionLogger.setArguments({connectionId, ip, 'request': request.headers});

			if(request.method === 'OPTIONS') {
				response.writeHead(200, baseHeaders);
				response.end(JSON.stringify({'message': 'ok'}));
			} else {
				var PubSub = options.getPubSub(ConnectionLogger),
					EventMashine = options.getEventMashine(),
					ResponseBuilder = options.createJSONResponseBuilder(PubSub, EventMashine, ConnectionLogger),
					body = [];

				request.on('data', (chunk) => {
					body.push(chunk);
				}).on('end', () => {
					body = Buffer.concat(body).toString();
					ResponseBuilder.build(request, response, body, (status, result) => {
						response.writeHead(status, baseHeaders);
						response.end(result);
					});
				});
			}

			response.on('finish', () => {
				ConnectionLogger.note('Peer disconnected');
			});
			ConnectionLogger.note('Peer connected');
			this.emit('connection');
		});

		this.server.on('error', (e) => {
			if (e.code == 'EADDRINUSE') {
				this.logger.error(`server error, address already in use: ${e}`);
			} else {
				this.logger.error(`server error: ${e}`);
			}
		});

		this.server.on('close', () => {
			this.logger.error(`LogRoom server closing after handling ${this.connectionCount} connections`);
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