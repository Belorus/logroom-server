class LogRoomReject extends Error
{
	constructor(status, ...args) {
		super(status, ...args);
		this.status = status;
		Error.captureStackTrace(this, LogRoomReject);
	}
}

module.exports = LogRoomReject;