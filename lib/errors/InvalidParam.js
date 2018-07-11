class RedisInvalidParam extends Error
{
	constructor(...args) {
		super(...args);
		Error.captureStackTrace(this, RedisInvalidParam);
	}
}

module.exports = RedisInvalidParam;