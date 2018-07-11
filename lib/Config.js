const ConfigOptions = require('./constants/config-options');
const Underscore = require('underscore');

class Config
{
	constructor (options = {}) {
		var x = Underscore.clone(ConfigOptions.defaults);
		ConfigOptions.apply_options(options, x);
		Underscore.extend(this, x);
	}
}

module.exports = Config;