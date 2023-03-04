const Node = function(id, index, value) {
	this.id = id
	this.index = index;
	this.value = value;
	this.next = null;
}
const SLL = function() {
	const addedIDs = new Set();
	let start = { next: null };
	this.length = 0;
	this.addSorted = function(id, index, value) {
		const newNode = new Node(id, index, value);
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
						return;
					}
					sprinter = sprinter.next;
				}
				return;
			}
			runner = runner.next;
		}
		runner.next = newNode;
		addedIDs.add(id);
		this.length++;
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
			runner = runner.next;
		}
	}
	this.findById = function(id) {
		let runner = start;
		while (runner.next) {
			if (id == runner.next.id) {
				return runner.next.value;
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
			callback(runner.next.value);
			index++;
			runner = runner.next;
		}
	}
}

module.exports = SLL;
