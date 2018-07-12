const Events = require('events');
const WebSocketServer = require('ws').Server;
const http = require('http');
const {uuid, getCallerIP} = require('../helpers/functions');

class Server extends Events.EventEmitter
{
  constructor(/* options, listener */) {
    super();

    let options;

    if (typeof arguments[0] === 'function') {
      options = {};
      this.on('connection', arguments[0]);
    } else {
      options = arguments[0] || {};

      if (typeof arguments[1] === 'function') {
        this.on('connection', arguments[1]);
      }
    }
    this.logger = options.getServerLogger();
    this.connectionCount = 0;
    let baseHeaders = {
      "Access-Control-Allow-Origin": options.http.access_control_allow_origin,
      "Access-Control-Allow-Headers": "Content-Type, Content-Length, X-Requested-With, Accept",
      "Content-Type": "application/json; charset=utf-8"
    };
    this.server = http.createServer((request, response) => {
      this.logger.note(`Received request for ${request.url}`);
      if(request.method === 'OPTIONS') {
        response.writeHead(200, {
          "Access-Control-Allow-Origin": 'http://localhost:9000',
          "Access-Control-Allow-Credentials": false
        });
        response.end();
      } else {
        response.writeHead(404);
        response.end();
      }
    });

    let ConnectionLogger = options.getConnectionLogger();
    let PubSub = options.getPubSub(ConnectionLogger);
    let EventMashine = options.getEventMashine();
    let	ResponseBuilder = options.createJSONRPCResponseBuilder(PubSub, EventMashine, ConnectionLogger);

    let socketOptions = {
      pingInterval: 25000,
      pingTimeout: 60000
    };
    let io = require('socket.io')(this.server, socketOptions);
    io.on('connection', function (socket) {

      socket.emit('initialConnectConfirm', {hello: 'initial connect happened'});

      socket.on('сlientTestEvent', function () {
        let activeSessionsData = {command: 'get_active_sessions', data: {callback: 'logroom-callback-0'}};
        ResponseBuilder.build(activeSessionsData, (result) => {
          result.id = connectionId;
          io.emit('serverTestEvent', result);
        });
      });

      socket.on('get_active_sessions', function () {
        let activeSessionsData = {command: 'get_active_sessions'};
        ResponseBuilder.build(activeSessionsData, (result) => {
          io.emit('sendActiveSessions', result);
        });
      });

      socket.on('get_session_logs', function (sessionData) {
        let activeSessionsData = {command: 'listen_session', data: {session_id: sessionData.sessionId}};
        ResponseBuilder.build(activeSessionsData, (result) => {
          socket.emit('sessionLogsObserver', result);
        });
      });

      socket.on('stop_listen_session', function (sessionData) {
        let activeSessionsData = {command: 'stop_listen_session', data: {session_id: sessionData.sessionId}};
        ResponseBuilder.build(activeSessionsData, (result) => {
          socket.emit('news', {bar: 'disconnect happened'});
          socket.disconnect(true);
          socket.emit('stopLogsObserver', result);
        });
      });

      socket.on('disconnect', function () {
        socket.emit('news', {bar: 'disconnect happened'});
        socket.disconnect(true);
      });
    });
  }

  listen(port, host, callback) {
    this.logger.note(`LogRoom server binding to port ${port} on ${host || 'all IPs'} ...`);
    this.server.listen(port, host, () => {
      this.logger.note("successfully bound!");
      if(typeof(callback) === 'function') {
        callback.call(this);
      }
    });
  }
}

exports.create = function() {
  return new Server(arguments[0], arguments[1]);
};