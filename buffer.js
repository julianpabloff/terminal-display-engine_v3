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
	this.persistent = false; // makes the screen switching algorithm ignore this buffer, you won't have to draw to it for it to be maintained after the screen switch
	// this.id = assigned by manager

	// Canvas: the array that you are drawing on that you eventually render to this buffer
	// Current: what's already been rendered on this buffer
	let canvasCodes = new Uint16Array(this.size);
	let canvasFGs = new Uint32Array(this.size);
	let canvasBGs = new Uint32Array(this.size);
	let currentCodes = new Uint16Array(this.size);
	let currentFGs = new Uint32Array(this.size);
	let currentBGs = new Uint32Array(this.size);

	// Adds the buffer from manager > pendingBufferIds for the createScreenConstruction function
	let pending = false;
	const makePending = () => {
		if (pending) return;
		pending = true;
		manager.registerToPending(this.id);
	}

	// For the manager to lookup a buffer's canvas values at (screenX, screenY)
	// this should all go away thanks to ghostRender()
	this.screenToIndex = (x, y) => {
		if (x < this.x || x >= this.x + this.width || y < this.y || y >= this.y + this.height) return null;
		return ((y - this.y) * this.width) + x - this.x;
	}
	this.canvasLookup = index => { // returns PointData
		return {
			'code': canvasCodes.at(index),
			'fg': canvasFGs.at(index),
			'bg': canvasBGs.at(index)
		}
	}
	this.transferCanvas = function() {
		currentCodes = new Uint16Array(canvasCodes);
		currentFGs = new Uint32Array(canvasFGs);
		currentBGs = new Uint32Array(canvasBGs);
		canvasCodes = new Uint16Array(this.size);
		canvasFGs = new Uint32Array(this.size);
		canvasBGs = new Uint32Array(this.size);
	}

	// Writing to buffer
	let cursorIndex = 0;
	const coordinateIndex = (x, y) => (y * this.width) + x;
	this.cursorTo = (x, y) => cursorIndex = coordinateIndex(x, y);

	this.print = function(string, index, fg, bg) {
		let inheritCurrentBg = false;
		if (fg == null) fg = manager.fg;
		if (bg == null) {
			bg = manager.bg;
			inheritCurrentBg = !manager.bg;
		}

		const stringLength = string.length;
		let i = index;
		let stringIndex = 0;
		while (stringIndex < stringLength && i < this.size) {
			canvasCodes[i] = string.charCodeAt(stringIndex);
			canvasFGs[i] = fg;
			if (!inheritCurrentBg) canvasBGs[i] = bg;
			stringIndex++;
			i++;
		}
		cursorIndex += stringLength;
		if (cursorIndex >= this.size) cursorIndex = 0;
		makePending();
	}
	// this.write = function(string, fg = manager.fg, bg = manager.bg) {
	this.write = function(string, fg = null, bg = null) {
		this.print(string, cursorIndex, fg, bg);
		return this;
	}
	// this.draw = function(string, x, y, fg = manager.fg, bg = manager.bg) {
	this.draw = function(string, x, y, fg = null, bg = null) {
		cursorIndex = coordinateIndex(x, y);
		this.print(string, cursorIndex, fg, bg);
		return this;
	}

	this.render = function(paint = false, debug = false) {
		// if (!pending || this.hidden) return;
		const start = Date.now();
		let i = 0;
		do { // Loop through buffer
			let code = canvasCodes.at(i);
			let fg = canvasFGs.at(i);
			let bg = canvasBGs.at(i);
			const currentCode = currentCodes.at(i);
			const currentFg = currentFGs.at(i);
			const currentBg = currentBGs.at(i);

			// Paint functionality
			if (paint) {
				if (!code && currentCode) {
					canvasCodes[i] = 0;
					canvasFGs[i] = 0;
					canvasBGs[i] = 0;
					i++;
					continue;
				} else if (code && !bg) bg = currentBg;
			}

			const screenX = this.x + (i % this.width);
			const screenY = this.y + Math.floor(i / this.width);

			if (code != currentCode || fg != currentFg || bg != currentBg)
				manager.requestDraw(code, fg, bg, screenX, screenY, this.id, this.zIndex);

			currentCodes[i] = code;
			currentFGs[i] = fg;
			currentBGs[i] = bg;
			canvasCodes[i] = 0;
			canvasFGs[i] = 0;
			canvasBGs[i] = 0;
			i++;
		} while (i < this.size && !debug);

		manager.executeRenderOutput(this.id);
		pending = false;

		// process.stdout.cursorTo(0, 0);
		// console.log('render took ' + (Date.now() - start) + 'ms');
	}

	this.ghostRender = function(screenWidth, clearCurrent = false) { // only changes the screen construction
		let i = 0;
		const affectedIndeces = [];
		do { // Loop through buffer
			const code = canvasCodes.at(i);
			const fg = canvasFGs.at(i);
			const bg = canvasBGs.at(i);

			let currentCode = 0;
			let currentFg = 0;
			let currentBg = 0;
			if (!clearCurrent) {
				currentCode = currentCodes.at(i);
				currentFg = currentFGs.at(i);
				currentBg = currentBGs.at(i);
			}

			const screenX = this.x + (i % this.width);
			const screenY = this.y + Math.floor(i / this.width);

			if (code != currentCode || fg != currentFg || bg != currentBg) {
				manager.applyToConstruction(code, fg, bg, screenX, screenY, this.id, this.zIndex);
				const screenIndex = screenY * screenWidth + screenX;
				affectedIndeces.push(screenIndex);
			}

			currentCodes[i] = code;
			currentFGs[i] = fg;
			currentBGs[i] = bg;
			canvasCodes[i] = 0;
			canvasFGs[i] = 0;
			canvasBGs[i] = 0;
			i++;
		} while (i < this.size);
		pending = false;
		return affectedIndeces; // need to go through these and determineConstructionOutput()
	}

	this.paint = () => this.render(true);

	this.fill = function(color) {
		canvasCodes.fill(32); // If there aren't spaces, that counts as an erasal
		canvasBGs.fill(color);
		// manager.setBg(color);
		makePending();
		return this;
	}

	// TODO: buffer.move()
	// you can use the massRender() process to render the move in one draw:
	//  - save the buffer canvas in temp, then empty the canvas
	//  - call ghostRender() on the buffer with the now empty canvas, effectively removing it from the screenConstruction
	//  - move the buffer (merely change this.x and this.y to the parameters)
	//  - repopulate the canvas and call ghostRender() again, which inserts the canvas into the screenConstruction
	//  - process the affectedLocations and executeRenderOutput() (break the affectedLocations.forEach() out into its own function)
	//  - tldr: it's just a screen switch but with one buffer
}

module.exports = DisplayBuffer;
