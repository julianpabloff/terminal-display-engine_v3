const DisplayBuffer = function(x, y, width, height, manager, zIndex) {
	this.x = x;
	this.y = y;
	this.width = width;
	this.height = height;
	this.end = width - 1;
	this.bottom = height - 1;
	this.size = width * height;
	this.zIndex = zIndex;
	this.empty = true; // are the current arrays empty?
	this.persistent = false; // makes the screen switching algorithm ignore this buffer, you won't have to draw to it for it to be maintained after the screen switch
	this.pauseRenders = false;
	// this.id = assigned by manager

	// TODO: Move variables to private:
	const bufferWidth = width;
	const bufferHeight = height;
	const bufferSize = width * height;

	// Just an idea, just more abstraction, would bring back this.show() and this.hide()
	// this.hidden = false;

	// Canvas: the array that you are drawing on that you eventually render to this buffer
	// Current: what's already been rendered on this buffer
	let canvasCodes = new Uint16Array(bufferSize);
	let canvasFGs = new Uint32Array(bufferSize);
	let canvasBGs = new Uint32Array(bufferSize);
	let currentCodes = new Uint16Array(bufferSize);
	let currentFGs = new Uint32Array(bufferSize);
	let currentBGs = new Uint32Array(bufferSize);

	// For when the manager clears the screen
	this.clearCurrent = function() {
		currentCodes.fill(0);
		currentFGs.fill(0);
		currentBGs.fill(0);
		this.empty = true;
	}

	// Writing to buffer
	const coordinateIndex = (x, y) => (y * this.width) + x;
	const coordinateIndexNew = (x, y) => {
		if (x < 0 || x >= bufferWidth) return null;
		if (y < 0 || y >= bufferHeight) return null;
		return (y * bufferWidth) + x;
	}
	let cursorIndex = 0;
	this.cursorTo = (x, y) => cursorIndex = coordinateIndex(x, y);

	this.wrap = false;
	this.opacity = 100;

	const processBrush = (fg, bg) => {
		let inheritBG = false;
		if (fg == null) fg = manager.fg;
		if (bg == null) {
			bg = manager.bg;
			inheritBG = !manager.bg;
		}
		if (this.opacity < 100) {
			fg = manager.fadeColor(fg, this.opacity);
			bg = manager.fadeColor(bg, this.opacity);
		}
		return {
			fg: fg,
			bg: bg,
			inheritBG: inheritBG
		}
	}
	this.write = function(string, fg = null, bg = null) {
		const brushSettings = processBrush(fg, bg);
		let i = 0;
		let startIndex = cursorIndex;
		const stringLength = string.length;
		const available = this.width - cursorIndex % this.width;
		do { // Loop through string
			const progress = cursorIndex - startIndex;
			if (!this.wrap && progress >= available) {
				break;
			}
			canvasCodes[cursorIndex] = string.charCodeAt(i);
			canvasFGs[cursorIndex] = brushSettings.fg;
			if (!brushSettings.inheritBG) canvasBGs[cursorIndex] = brushSettings.bg;
			cursorIndex++;
			if (cursorIndex >= bufferSize) {
				cursorIndex = 0;
				break;
			}
			i++;
		} while (i < stringLength);
		return this;
	}
	this.draw = function(string, x, y, fg = null, bg = null) {
		const brushSettings = processBrush(fg, bg);
		let currentX = x;
		let i = 0;
		const stringLength = string.length;
		do { // Loop through string
			const index = coordinateIndexNew(currentX, y);
			if (index != null) {
				canvasCodes[index] = string.charCodeAt(i);
				canvasFGs[index] = brushSettings.fg;
				if (!brushSettings.inheritBG) canvasBGs[index] = brushSettings.bg;
				cursorIndex = index + 1;
			}
			currentX++;
			i++;
		} while (i < stringLength);
		return this;
	}

	this.centerWidth = width => Math.floor(this.width / 2 - width / 2);
	this.centerHeight = height => Math.floor(this.height / 2 - height / 2);

	// Rendering
	this.render = function(paint = false) {
		if (manager.pauseRenders || this.pauseRenders) return;
		this.empty = true;
		let i = 0;
		do { // Loop through buffer
			const code = canvasCodes.at(i);
			const fg = canvasFGs.at(i);
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

			if (code && this.empty) this.empty = false;
			currentCodes[i] = code;
			currentFGs[i] = fg;
			currentBGs[i] = bg;
			canvasCodes[i] = 0;
			canvasFGs[i] = 0;
			canvasBGs[i] = 0;
			i++;
		} while (i < this.size);
		manager.executeRenderOutput(this.id);
	}

	this.paint = () => this.render(true);

	this.fill = function(color) {
		canvasCodes.fill(32); // If there aren't spaces, that counts as an erasal
		if (this.opacity < 100) color = manager.fadeColor(color, this.opacity);
		canvasBGs.fill(color);
		// manager.setBg(color);
		return this;
	}

	this.ghostRender = function() { // only changes the screen construction
		this.empty = true;
		let i = 0;
		do { // Loop through buffer
			const code = canvasCodes.at(i);
			const fg = canvasFGs.at(i);
			const bg = canvasBGs.at(i);
			const currentCode = currentCodes.at(i);
			const currentFg = currentFGs.at(i);
			const currentBg = currentBGs.at(i);

			const screenX = this.x + (i % this.width);
			const screenY = this.y + Math.floor(i / this.width);

			if (code != currentCode || fg != currentFg || bg != currentBg)
				manager.requestGhostDraw(code, fg, bg, screenX, screenY, this.id, this.zIndex);

			if (code && this.empty) this.empty = false;
			currentCodes[i] = code;
			currentFGs[i] = fg;
			currentBGs[i] = bg;
			canvasCodes[i] = 0;
			canvasFGs[i] = 0;
			canvasBGs[i] = 0;
			i++;
		} while (i < this.size);
	}

	// Should really only be used to position buffers relative to the screen size
	// For moving objects just make a buffer for the object to move around in
	this.move = function(x, y, renderDestination = true) {
		if (renderDestination && x == this.x && y == this.y) return;
		if (!this.empty) {
			let i = 0;
			do { // Loop through buffer
				const code = currentCodes.at(i);
				const fg = currentFGs.at(i);
				const bg = currentBGs.at(i);
				const eraseX = this.x + (i % this.width);
				const eraseY = this.y + Math.floor(i / this.width);
				const drawX = x + (i % this.width);
				const drawY = y + Math.floor(i / this.width);

				const noOverlapX = eraseX < x || eraseX > x + this.end;
				const noOverlapY = eraseY < y || eraseY > y + this.bottom;
				if (noOverlapX || noOverlapY || !renderDestination)
					manager.requestGhostDraw(0, 0, 0, eraseX, eraseY, this.id, this.zIndex);
				if (renderDestination)
					manager.requestGhostDraw(code, fg, bg, drawX, drawY, this.id, this.zIndex);
				i++;
			} while (i < this.size);
			manager.executeGhostRender();
		}
		this.x = x;
		this.y = y;
	}
}

module.exports = DisplayBuffer;
