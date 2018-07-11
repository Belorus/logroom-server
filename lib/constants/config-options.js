var defaults = {
	"listen": {
		"ws": false,
		"http": false
	},
	"redis": {
		"host": false,
		"port": false,
		"db": false
	},
	"mysql": {
		"host": false,
		"port": false,
		"db": false,
		"user": false,
		"secret": false
	},
	"http": {
		"access_control_allow_origin": "*"
	}
};
var Args = require('yargs').usage('$0 --help | --show-config [OPTIONS] | [OPTIONS]').options({
	'help': {
		'describe': 'give this help list'
	},
	'show-config': {
		'describe': 'show current config and exit'
	},
	'config': {
		'describe': 'path to configuration file',
		'requiresArg': true
	},
	'listen.ws': {
		'describe': 'listen on port for WS:// server protocol requests',
		'default': true
	},
	'listen.http': {
		'describe': 'listen on port for http:// server protocol requests',
		'default': true
	},
	'redis.host': {
		'describe': 'Connect to redis host',
		'default': '127.0.0.1',
		'requiresArg': true
	},
	'redis.port': {
		'describe': 'redis port number to use for connection',
		'default': 6379,
		'requiresArg': true
	},
	'redis.db': {
		'describe': 'redis database to use',
		'default': 0,
		'requiresArg': true
	},
	'mysql.host': {
		'describe': 'Connect to MySQL host',
		'default': 'localhost',
		'requiresArg': true
	},
	'mysql.port': {
		'describe': 'MySQL port number to use for connection',
		'default': 3306,
		'requiresArg': true
	},
	'mysql.db': {
		'describe': 'MySQL database to use',
		'default': 'test',
		'requiresArg': true
	},
	'mysql.user': {
		'describe': 'User name to use when connecting to MySQL server',
		'default': 'test',
		'requiresArg': true
	},
	'mysql.secret': {
		'describe': 'Password to use when connecting to MySQL server',
		'default': false,
		'requiresArg': true
	},
	'http.access_control_allow_origin': {
		'describe': 'Access-Control-Allow-Origin',
		'default': '*',
		'requiresArg': false
	}
}).config('config').check((argv) => {
	var err = [];
	['ws', 'http'].forEach((k) => {
		var v = argv.listen[k], m;
		if(v instanceof Array){
			v = v.pop();
		}
		if(v !== false) {
			m = /^(?:(.+):)?([1-9][0-9]*)$/.exec(v);
			if(m) {
				defaults.listen[k]=argv.listen[k] = {
					'host': m[1] ? m[1] : '0.0.0.0',
					'port': parseInt(m[2], 10)
				};
			} else {
				err.push(`Incorrect value of listen. ${k} parameter`);
			}
		}
	});
	argv.redis.port = parseInt(argv.redis.port, 10);
	argv.redis.db = parseInt(argv.redis.db, 10);
	argv.mysql.port = parseInt(argv.mysql.port, 10);
	if(err.length) {
		throw err.join("\n");
	}

	return true;
});

var Argv = Args.argv;
if (Argv.help) {
	Args.showHelp();
	process.exit(0);
}

if (Argv.showConfig) {
	x = JSON.stringify(defaults, null, 4);
	console.log(x);
	process.exit(0);
}

function apply_options(opts, defaults) {
	if (!(
		opts &&
		typeof(opts) == "object" &&
		defaults &&
		typeof(defaults) == "object"
	)) {
		return defaults;
	}

	for (let k in opts) {
		if (opts.hasOwnProperty(k)) {
			if (defaults.hasOwnProperty(k)) {
				if (typeof(opts[k]) == "object") {
					if (opts[k] instanceof Array) {
						defaults[k] = opts[k].pop();
					} else {
						apply_options(opts[k], defaults[k]);
					}
				} else {
					defaults[k] = opts[k];
				}
			}
		}
	}

	return defaults;
}

exports.apply_options = apply_options;

exports.defaults = apply_options(Argv, defaults);