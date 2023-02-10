const DisplayBuffer = function(x, y, width, height, manager, zIndex) {
	this.x = x;
	this.y = y;
	this.width = width;
	this.height = height;
	this.end = width - 1;
	this.bottom = height - 1;
	this.size = width * height;
	this.zIndex = zIndex;
	this.hidden = false;

	const currentCode = new Uint16Array(this.size);
	const currentFg = new Uint32Array(this.size);
	const currentBg = new Uint32Array(this.size);
	const previousCode = new Uint16Array(this.size);
	const previousFg = new Uint32Array(this.size);
	const previousBg = new Uint32Array(this.size);
	let changed = false;

	// Writing to buffer
	let cursorIndex = 0;
	const coordinateIndex = (x, y) => (y * this.width) + x;
	this.cursorTo = (x, y) => cursorIndex = coordinateIndex(x, y);

	this.print = function(string, index, fg, bg) {
		const stringLength = string.length;
		let i = index;
		let stringIndex = 0;
		while (stringIndex < stringLength && i < this.size) {
			currentCode[i] = string.charCodeAt(stringIndex);
			currentFg[i] = fg;
			currentBg[i] = bg;
			stringIndex++;
			i++;
		};
		cursorIndex = index + string.length;
		if (cursorIndex > this.size) cursorIndex = 0;
		changed = true;
	}
	this.write = function(string, fg = manager.fg, bg = manager.bg) {
		this.print(string, cursorIndex, fg, bg);
		return this;
	}
	this.draw = function(string, x, y, fg = manager.fg, bg = manager.bg) {
		const index = coordinateIndex(x, y);
		this.print(string, index, fg, bg);
		return this;
	}

	this.render = function() {
		if (!changed || this.hidden) return;
		// console.log('buffer size: ' + this.size);
		// console.log(currentCode);
		manager.createRenderOutput();
		let i = 0;
		do { // Loop through buffer
			const code = currentCode.at(i);
			const fg = currentFg.at(i);
			const bg = currentBg.at(i);
			const prevCode = previousCode.at(i);
			const prevFg = previousFg.at(i);
			const prevBg = previousBg.at(i);
			const screenX = this.x + (i % this.width);
			const screenY = this.y + Math.floor(i / this.width);

			if (code != prevCode || fg != prevFg || bg != prevBg)
				manager.requestDraw(code, fg, bg, screenX, screenY, this.zIndex);
			i++;
		} while (i < this.size);
		manager.executeRenderOutput();
	}
}

module.exports = DisplayBuffer;
