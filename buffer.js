const DisplayBuffer = function(manager, x, y, width, height, zIndex) {
	this.x = x;
	this.y = y;
	this.width = width;
	this.height = height;
	this.end = width - 1;
	this.bottom = height - 1;
	this.size = width * height;
	this.zIndex = zIndex;
	this.persistent = false; // makes manager.massRender ignore this buffer, it won't disappear if not drawn to
	this.pauseRenders = false;
	// this.id = assigned by manager, don't change

	// Private variables for internal reference
	let bufferX = x;
	let bufferY = y;
	let bufferZ = zIndex;
	const bufferWidth = width;
	const bufferHeight = height;
	const bufferSize = width * height;
	let canvasEmpty = true;
	let inConstruction = false;

	// Just an idea, just more abstraction, would bring back this.show() and this.hide()
	// this.hidden = false;

	// Canvas: the array that you are drawing on that you eventually render to this buffer
	// Current: what's already been rendered on this buffer
	const canvasCodes = new Uint16Array(bufferSize);
	const canvasFGs = new Uint32Array(bufferSize);
	const canvasBGs = new Uint32Array(bufferSize);
	const currentCodes = new Uint16Array(bufferSize);
	const currentFGs = new Uint32Array(bufferSize);
	const currentBGs = new Uint32Array(bufferSize);

	// For when the manager clears the screen
	this.clearCurrent = function() {
		currentCodes.fill(0);
		currentFGs.fill(0);
		currentBGs.fill(0);
		inConstruction = false;
	}

	// Writing to buffer
	const coordinateIndex = (x, y) => {
		if (x < 0 || x >= bufferWidth) return null;
		if (y < 0 || y >= bufferHeight) return null;
		return (y * bufferWidth) + x;
	}
	let cursorIndex = 0;
	this.cursorTo = (x, y) => {
		const index = coordinateIndex(x, y);
		if (index != null) cursorIndex = index;
	}
	this.centerWidth = width => Math.floor(bufferWidth / 2 - width / 2);
	this.centerHeight = height => Math.floor(bufferHeight / 2 - height / 2);

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
		const stringLength = string.length;
		if (!stringLength) return this;
		const brushSettings = processBrush(fg, bg);
		const startIndex = cursorIndex;
		const available = bufferWidth - cursorIndex % bufferWidth;
		let i = 0;
		do { // Loop through string
			const progress = cursorIndex - startIndex;
			if (!this.wrap && progress >= available) return this;

			canvasCodes[cursorIndex] = string.charCodeAt(i);
			canvasFGs[cursorIndex] = brushSettings.fg;
			if (!brushSettings.inheritBG) canvasBGs[cursorIndex] = brushSettings.bg;
			if (canvasEmpty) canvasEmpty = false;

			cursorIndex++;
			if (cursorIndex >= bufferSize) {
				cursorIndex = 0;
				return this;
			}
			i++;
		} while (i < stringLength);
		return this;
	}
	this.draw = function(string, x, y, fg = null, bg = null) {
		const stringLength = string.length;
		if (!stringLength) return this;
		const brushSettings = processBrush(fg, bg);
		let index;
		let i = 0;
		do { // Loop through string
			if (this.wrap) index = coordinateIndex(x, y) + i;
			else index = coordinateIndex(x + i, y);
			if (index != null) {
				canvasCodes[index] = string.charCodeAt(i);
				canvasFGs[index] = brushSettings.fg;
				if (!brushSettings.inheritBG) canvasBGs[index] = brushSettings.bg;
				if (canvasEmpty) canvasEmpty = false;
				cursorIndex = index + 1;
			}
			i++;
		} while (i < stringLength);
		return this;
	}
	this.drawAbsolute = function(string, screenX, screenY, fg = null, bg = null) {
		const temp = this.wrap;
		this.wrap = false;
		const x = screenX - bufferX;
		const y = screenY - bufferY;
		this.draw(string, x, y, fg, bg);
		this.wrap = temp;
		return this;
	}
	this.erase = function(x, y, count) {
		let i = 0;
		let index;
		do { // Loop through count
			if (this.wrap) index = coordinateIndex(x, y) + i;
			else index = coordinateIndex(x + i, y);
			if (index != null) {
				canvasCodes[index] = 0;
				canvasFGs[index] = 0;
				canvasBGs[index] = 0;
			}
			i++;
		} while (i < count);
		return this;
	}

	this.fill = function(color) {
		canvasCodes.fill(32);
		if (this.opacity < 100) color = manager.fadeColor(color, this.opacity);
		canvasBGs.fill(color);
		canvasEmpty = false;
		return this;
	}

	// Rendering
	// TODO: What if instead of looping through the entire buffer, you stored the indeces
	// that you need to check - the indeces width canvasCodes and the indeces with currentCodes
	// that potentially need to be cleared
	// const canvasIndeces = new Set();
	// const currentIndeces = new Set();

	this.render = function(paint = false) {
		if (manager.pauseRenders || this.pauseRenders) return;
		if (!inConstruction && canvasEmpty) return;
		inConstruction = false;
		let i = 0;
		do { // Loop through buffer
			const code = canvasCodes.at(i);
			const fg = canvasFGs.at(i);
			let bg = canvasBGs.at(i);
			canvasCodes[i] = 0;
			canvasFGs[i] = 0;
			canvasBGs[i] = 0;
			const currentCode = currentCodes.at(i);
			const currentFg = currentFGs.at(i);
			const currentBg = currentBGs.at(i);
			currentCodes[i] = code;
			currentFGs[i] = fg;
			currentBGs[i] = bg;

			// TODO: Fix paint here too (prevent clearing current?)
			if (paint) {
				if (!code && currentCode) {
					i++;
					continue;
				} else if (code && !bg) bg = currentBg;
			}

			let enteredConstruction = false;
			if (code != currentCode || fg != currentFg || bg != currentBg) {
				const screenX = bufferX + (i % bufferWidth);
				const screenY = bufferY + Math.floor(i / bufferWidth);
				enteredConstruction = manager.requestDraw(code, fg, bg, screenX, screenY, this.id, bufferZ);
			}
			if (enteredConstruction && !inConstruction) inConstruction = true;
			i++;
		} while (i < bufferSize);
		canvasEmpty = true;
		manager.executeRenderOutput(this.id);
	}
	this.paint = () => this.render(true);

	// Despite how cool this function is, it's still recommended to move a drawing within a buffer,
	// instead of moving the entire buffer (for performance), but here you go
	const move = function(renderDestination, x, y, zIndex) {
		if (x == null) x = this.x; else this.x = x;
		if (y == null) y = this.y; else this.y = y;
		if (zIndex == null) zIndex = this.zIndex; else this.zIndex = zIndex;
		const differentZ = zIndex != bufferZ;
		const sameCoordinates = x == bufferX && y == bufferY && !differentZ;
		if (renderDestination && sameCoordinates) return;

		if (inConstruction) { // Ghost move
			let i = 0;
			do { // Loop through buffer
				const localX = i % bufferWidth;
				const localY = Math.floor(i / bufferWidth);
				const eraseX = bufferX + localX;
				const eraseY = bufferY + localY;
				const drawX = x + localX;
				const drawY = y + localY;

				const noOverlapX = eraseX < x || eraseX > x + bufferWidth - 1;
				const noOverlapY = eraseY < y || eraseY > y + bufferHeight - 1;
				const erase = noOverlapX || noOverlapY || !renderDestination || differentZ;

				if (erase) {
					manager.requestGhostDraw(0, 0, 0, eraseX, eraseY, this.id, bufferZ);
					if (renderDestination && !noOverlapX && !noOverlapY) { // only happens when differentZ
						const lookbackX = localX - (x - bufferX);
						const lookbackY = localY - (y - bufferY);
						const index = coordinateIndex(lookbackX, lookbackY);
						const code = currentCodes.at(index);
						const fg = currentFGs.at(index);
						const bg = currentBGs.at(index);
						manager.requestGhostDraw(code, fg, bg, eraseX, eraseY, this.id, zIndex);
					}
				}
				if (renderDestination) {
					const noDrawOverlapX = drawX < bufferX || drawX > bufferX + bufferWidth - 1;
					const noDrawOverlapY = drawY < bufferY || drawY > bufferY + bufferHeight - 1;
					if (!differentZ || (differentZ && (noDrawOverlapX || noDrawOverlapY))) {
						const code = currentCodes.at(i);
						const fg = currentFGs.at(i);
						const bg = currentBGs.at(i);
						manager.requestGhostDraw(code, fg, bg, drawX, drawY, this.id, zIndex);
					}
				} else {
					currentCodes[i] = 0;
					currentFGs[i] = 0;
					currentBGs[i] = 0;
				}
				i++;
			} while (i < bufferSize);
			manager.executeGhostRender();
		}
		bufferX = x;
		bufferY = y;
		bufferZ = zIndex;
	}.bind(this);

	// You are able to change this.x, this.y, and this.zIndex separately and then call this.move() / this.quietMove()
	// Or if you provide the parameters, the this.<parameters> get updated
	this.move = (x = null, y = null, zIndex = null) => move(true, x, y, zIndex);
	this.quietMove = (x = null, y = null, zIndex = null) => move(false, x, y, zIndex);

	// Changes only the screen construction, called by manager only
	this.ghostRender = function() {
		if (inConstruction && this.persistent) return; // only avoid erasing the buffer, not drawing the buffer (from its canvas)
		if (!inConstruction && canvasEmpty) return;
		inConstruction = false;
		let i = 0;
		do { // Loop through buffer
			const code = canvasCodes.at(i);
			const fg = canvasFGs.at(i);
			const bg = canvasBGs.at(i);
			canvasCodes[i] = 0;
			canvasFGs[i] = 0;
			canvasBGs[i] = 0;
			const currentCode = currentCodes.at(i);
			const currentFg = currentFGs.at(i);
			const currentBg = currentBGs.at(i);
			currentCodes[i] = code;
			currentFGs[i] = fg;
			currentBGs[i] = bg;

			const screenX = bufferX + (i % bufferWidth);
			const screenY = bufferY + Math.floor(i / bufferWidth);

			let enteredConstruction = false;
			if (code != currentCode || fg != currentFg || bg != currentBg)
				enteredConstruction = manager.requestGhostDraw(code, fg, bg, screenX, screenY, this.id, bufferZ);
			if (enteredConstruction && !inConstruction) inConstruction = true;

			i++;
		} while (i < bufferSize);
		canvasEmpty = true;
	}
}

module.exports = DisplayBuffer;
