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

	// Canvas: the array that you are drawing on that you eventually render to this buffer
	// Current: what's already been rendered on this buffer
	const canvasCodes = new Uint16Array(this.size);
	const canvasFGs = new Uint32Array(this.size);
	const canvasBGs = new Uint32Array(this.size);
	const currentCodes = new Uint16Array(this.size);
	const currentFGs = new Uint32Array(this.size);
	const currentBGs = new Uint32Array(this.size);
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
			canvasCodes[i] = string.charCodeAt(stringIndex);
			canvasFGs[i] = fg;
			canvasBGs[i] = bg;
			stringIndex++;
			i++;
		};
		cursorIndex += stringLength;
		if (cursorIndex >= this.size) cursorIndex = 0;
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

	this.render = function(debug = false) {
		if (!changed || this.hidden) return;
		const start = Date.now();
		manager.createRenderOutput();
		let i = 0;
		do { // Loop through buffer
			const code = canvasCodes[i];
			const fg = canvasFGs[i];
			const bg = canvasBGs[i];
			const currentCode = currentCodes[i];
			const currentFg = currentFGs[i];
			const currentBg = currentBGs[i];
			const screenX = this.x + (i % this.width);
			const screenY = this.y + Math.floor(i / this.width);

			if (code != currentCode || fg != currentFg || bg != currentBg) {
				if (debug) manager.requestDrawDebug(code, fg, bg, screenX, screenY, this.id, this.zIndex);
				else manager.requestDraw(code, fg, bg, screenX, screenY, this.id, this.zIndex);
			}

			currentCodes[i] = code;
			currentFGs[i] = fg;
			currentBGs[i] = bg;
			canvasCodes[i] = 0;
			canvasFGs[i] = 0;
			canvasBGs[i] = 0;
			i++;
		} while (i < this.size && !debug);
		// console.log(currentCodes);
		manager.executeRenderOutput();
		// process.stdout.cursorTo(0, 0);
		// console.log('render took ' + (Date.now() - start) + 'ms');
	}

	this.fill = function(color) {
		canvasCodes.fill(32); // If there aren't spaces, that counts as an erasal
		canvasBGs.fill(color);
		changed = true;
		return this;
	}
}

module.exports = DisplayBuffer;
