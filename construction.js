const Node = function(id, index, data) {
	this.id = id;
	this.index = index;
	this.data = data;
	this.next = null;
}
const Construction = function() {
	const addedIDs = new Set();
	let start = { next: null };
	this.length = 0;
	this.addSorted = function(id, index, data) {
		const newNode = new Node(...arguments);
		let runner = start;
		while (runner.next) {
			// Replaces duplicate instead of adding to the sll
			if (id == runner.next.id) {
				const temp = runner.next.next;
				runner.next = newNode;
				runner.next.next = temp;
				return;
			}
			if (index < runner.next.index) {
				const temp = runner.next;
				runner.next = newNode;
				runner.next.next = temp;
				addedIDs.add(id);
				this.length++;
				
				let sprinter = runner.next.next;
				while (sprinter.next) {
					if (id == sprinter.next.id) {
						sprinter.next = sprinter.next.next;
						this.length--;
						return;
					}
					sprinter = sprinter.next;
				}
				return;
			}
			runner = runner.next;
		}
	}
	this.deleteById = function(id) {
		let runner = start;
		while (runner.next) {
			if (id == runner.next.id) {
				runner.next = runner.next.next;
				this.length--;
				addedIDs.delete(id);
				return;
			}
		}
	}
	this.findById = function(id) {
		let runner = start;
		while (runner.next) {
			if (id == runner.next.id) {
				return runner.next.data;
			}
			runner = runner.next;
		}
		return false;
	}
	this.has = function(id) {
		return addedIDs.has(id);
	}
	this.forEach = function(callback) {
		let runner = start;
		let index = 0;
		while (runner.next) {
			callback(runner.next.data);
			index++;
			runner = runner.next;
		}
	}
}

const ConstructionManager = function() {
	this.create = () => new Construction();
	this.apply = function(construction, id, sortIndex, data) {
		let add = false;
		if (data instanceof PointData)
	}

	this.determineOutput = construction => {
	}

	const hexDebugString = color => {
		if (!color) return resetColorString + '[none]' + resetColorString;
		const hex = getHex(color);
		const ANSI = fgHexToString(hex);
		const hexString = hex.toString(16);
		return ANSI + '#' + '0'.repeat(6 - hexString.length) + hexString + resetColorString;
	};
	this.debug = construction => {
		if (!construction.length) {
			console.log('this construction is empty');
			return;
		}
		console.log('construction length', construction.length);
		construction.forEach(item => {
			for (const key of Object.keys(item)) {
				const logArray = ['   ', key];
				const value = item[key];
				if (key != 'code') {
					logArray.push(hexDebugString(value), getOpacity(value));
				} else logArray.push(value);
				console.log(...logArray);
			}
			console.log();
		});
	}
}

module.exports = ConstructionManager;
