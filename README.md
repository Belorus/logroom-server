## LogRoom Server module

## Install:
```
npm install git+ssh://git@github.com:Belorus/logroom-server.git
```

## Usage:
- Start http:// server
```
const LogRoomServer = require('logroom-server');
LogRoomServer.getInstance().init_http();
```
- Start ws:// server
```
const LogRoomServer = require('logroom-server');
LogRoomServer.getInstance().init_ws();
```
- HTTP:
```
# Send POST to /push_logs to add list of logs. Body:
{
  "session_id": "fa9d8350-a167-44ca-a2b4-829157416cef",
  "seq_number": 1,
  "logs": [
    {
      "categories": [],
      "level": "INFO ",
      "message": ">>> LogManager initialized successfully. UTC time: Thu, 03 May 2018 13:03:56 GMT",
      "tag": "XLog.LogManager",
      "thread": 4,
      "timestamp": 1525363436287
    }
  ]
}
```
- WebSocket uses socket.io library:
```
# Get active sessions at this moment
socket.emit("get_active_sessions");
# Get sessions list
socket.emit("get_session_list", {
  "page": 1,
  "filter": {
    "os": "iOS",
    "os_version": "11.4.0"
  }
});
# Get logs by session
socket.emit("get_logs_by_session", {
  "session_id": "fa9d8350-a167-44ca-a2b4-829157416cef",
  "page": 1
});
# Listen session
socket.emit("listen_session", {
  "session_id": "fa9d8350-a167-44ca-a2b4-829157416cef"
});
# Stop listen session
socket.emit("stop_listen_session", {
  "session_id": "fa9d8350-a167-44ca-a2b4-829157416cef"
});
# Listen active sessions
socket.emit("listen_active_sessions");
# Stop listen active sessions
socket.emit("stop_listen_session");
```
- WebSocket commands back:

`sendActiveSessions`: Result of sending `get_active_sessions`

`listen_session`: Result of sending `listen_session`

`stopLogsObserver`: Result of sending `stop_listen_session`

`listen_active_sessions`: Result of sending `listen_active_sessions`

`stop_listen_active_sessions`: Result of sending `stop_listen_active_sessions`

`get_session_list`: Result of sending `get_session_list`

`get_logs_by_session`: Result of sending `get_logs_by_session`

`sessionLogsObserver`: Send back logs by session

`publish_session`: Send back active session info

`unknown_command`: Will be sent back if some command does not exists


## Options:
`--help`: Give the help list

`--show-config`: Show default config and exit

`--config`: Path to configuration file

`--listen.ws`: Listen on port for WS:// server protocol requests

`--listen.http`: Listen on port for http:// server protocol requests

`--redis.host`: Connect to redis host

`--redis.port`: Redis port number to use for connection

`--redis.db`: Redis database to use

`--mysql.host`: Connect to MySQL host

`--mysql.port`: MySQL port number to use for connection

`--mysql.db`: MySQL database to use

`--mysql.user`: User name to use when connecting to MySQL server

`--mysql.secret`: Password to use when connecting to MySQL server

`--http.access_control_allow_origin`: Access-Control-Allow-Origin
