## LogRoom Server module

## Install:
```
npm install https://github.com/Belorus/logroom-server.git
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
- WebSocket
```
# Send 'push_log' to add new log. Message:
{
  "command": "push_log",
  "data": {
    "session_id": "fa9d8350-a167-44ca-a2b4-829157416cef",
    "seq_number": 1,
    "log": {
      "categories": [],
      "level": "INFO ",
      "message": ">>> LogManager initialized successfully. UTC time: Thu, 03 May 2018 13:03:56 GMT",
      "tag": "XLog.LogManager",
      "thread": 4,
      "timestamp": 1525363436287
    }
  }
}
# Send 'push_logs' to add list of logs. Message:
{
  "command": "push_logs",
  "data": {
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
    ],
    "additional": {
        "os": "iOS",
        "os_version": "11.4.0"
    }
  }
}
# Get active sessions at this moment
{
  "command": "get_active_sessions",
  "data": {
    "callback": "logroom-callback-0"
  }
}
# Listen session
{
  "command": "listen_session",
  "data": {
    "session_id": "fa9d8350-a167-44ca-a2b4-829157416cef"
  }
}
# Stop listen session
{
  "command": "stop_listen_session",
  "data": {
    "session_id": "fa9d8350-a167-44ca-a2b4-829157416cef"
  }
}
```

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
