const RedisExt = require('./redis-ext');

class PubSub
{
	constructor(opts, logger) {
		this.pub = RedisExt.createRedisClient(opts);
		this.sub = RedisExt.createRedisClient(opts);
		this.logger = logger;
		this.channels = {};
		this.bindEvent = false;
	}

	subscribe(channel, callback, once) {
		if(typeof(callback) !== "function") {
			return false;
		}

		if(this.channels.hasOwnProperty(channel))
			if(once) {
				return;
			} else {
				this.sub.unsubscribe(channel);
			}
		this.channels[channel] = callback;
		this.sub.subscribe(channel);
		if(!this.bindEvent) {
			this.sub.on("message", (channel, message) => {
				if(typeof(this.channels[channel]) == "function") {
					try {
						this.channels[channel].call(this, JSON.parse(message));
					} catch(e) {
						this.logger.error(e.stack);
					}
				}
			});
			this.bindEvent = true;
		}
	}

	sendMsg(channel, data = {}) {
		this.pub.publish(channel, JSON.stringify(data));
	}

	unsubscribe(channel) {
		if(this.channels.hasOwnProperty(channel)) {
			this.sub.unsubscribe(channel);
			delete this.channels[channel];
		}
	}

	punsubscribe (pattern) {
		this.sub.punsubscribe(pattern);
		for(var prop in this.channels)
			if(prop.match(pattern))
				delete this.channels[prop];
	}

	close() {
		if(this.pub) {
			this.pub.end(true);
		}
		if(this.sub) {
			this.sub.end(true);
		}
	}
}

exports.create = (opts, logger) => {
	return new PubSub(opts, logger);
};
