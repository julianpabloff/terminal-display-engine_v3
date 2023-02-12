const Node = function(id, index, value) {
	this.id = id
	this.index = index;
	this.value = value;
	this.next = null;
}
const SLL = function() {
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
		this.length++;
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
