let Logger = (() => {
	function log(log = {}) {
		console.log(JSON.stringify(log));
	}
	class Logger
	{
		constructor(options = {'initArgStorage': false}) {
			this.useArgStorage = !!options.initArgStorage;
			this.args = {};
		}

		setArguments(args = {}) {
			if (!this.useArgStorage) {
				return false;
			}

			for(let k in args) {
				if (args.hasOwnProperty(k)) {
					this.args[k] = args[k];
				}
			}
		}

		error(error) {
			log(Object.assign({}, this.args, {error}));
		}

		warning(warning) {
			log(Object.assign({}, this.args, {warning}));
		}

		note(note) {
			log(Object.assign({}, this.args, {note}));
		}
	}

	return Logger;
})();

module.exports = Logger;