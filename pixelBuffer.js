const PixelDisplayBuffer = function(manager, x, y, width, height, zIndex) {
	this.x = x;
	this.y = y;
	this.width = width;
	this.height = height;
	this.end = width - 1;
	this.bottom = height - 1;
	this.size = width * height;
	this.zIndex = zIndex;
	this.persistent = false;
	this.pauseRenders = false;

	// Private variables for internal reference
	let bufferX = x;
	let bufferY = y;
	let bufferZ = zIndex;
	const bufferWidth = width;
	const bufferHeight = height;
	const bufferSize = width * height;
	let canvasEmpty = true;
	let inConstruction = false;

	let bufferId; // gets assigned by manager after creation
	this.assignId = id => bufferId = id;

	const canvas = new Uint32Array(bufferSize);
	const current = new Uint32Array(bufferSize);

	// For when the manager clears the screen
	this.clearCurrent = () => current.fill(0);

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
		return this;
	}
	this.centerWidth = width => Math.floor(bufferWidth / 2 - width / 2);
	this.centerHeight = height => Math.floor(bufferHeight / 2 - height / 2);

	this.wrap = false;
	this.opacity = 100;

	// this.write(color);
	// this.write(color, count);
	// this.write(colorArray);
	this.write = function(colorInput, count = 1) {
		let i = 0;
		let getColor, amount;
		if (typeof(colorInput) == 'number') {
			getColor = () => colorInput;
			amount = count;
		} else {
			getColor = () => colorInput.at(i);
			amount = colorInput.length;
			if (!amount) return this;
		}
		const startIndex = cursorIndex;
		const available = bufferWidth - cursorIndex % bufferWidth;
		do {
			canvas[cursorIndex] = getColor();
			if (canvasEmpty) canvasEmpty = false;
			cursorIndex++;
			if (!this.wrap && cursorIndex - startIndex >= available || cursorIndex >= bufferSize) break;
			i++;
		} while (i < amount);
		cursorIndex %= bufferSize;
		return this;
	}
	
	// this.draw(color, x, y);
	// this.draw(color, count, x, y)
	// this.draw(colorArray, x, y)
	this.draw = function(colorInput) {
		let i = 0;
		let index, getColor, amount;
		const argAmount = arguments.length;
		const x = arguments[argAmount - 2];
		const y = arguments[argAmount - 1];
		if (typeof(colorInput) == 'number') {
			getColor = () => colorInput;
			amount = 1 + (argAmount == 4) * (arguments[1] - 1);
		} else {
			getColor = () => colorInput.at(i);
			amount = colorInput.length;
			if (!amount) return this;
		}
		do {
			if (this.wrap) index = coordinateIndex(x, y) + i;
			else index = coordinateIndex(x + i, y);
			if (index != null) {
				canvas[index] = getColor();
				if (canvasEmpty) canvasEmpty = false;
				cursorIndex = index + 1;
			}
			i++;
		} while (i < amount);
		return this;
	}

	this.drawGrid = function(grid, legend, x = 0, y = 0) {
		let i = 0;
		const gridHeight = grid.length;
		do {
			let j = 0;
			const row = grid[i];
			const rowWidth = row.length;
			do {
				const index = coordinateIndex(x + j, y + i);
				if (index != null) {
					const color = legend[row[j]];
					if (color >> 24) canvas[index] = color;
					if (canvasEmpty) canvasEmpty = false;
				}
				j++;
			} while (j < rowWidth);
			i++;
		} while (i < gridHeight);
	}
	
	// TODO:
	// this.drawAbsolute(color, screenGridX, screenGridY);
	// this.drawAbsolute(color, count, screenGridX, screenGridY);
	// this.drawAbsolute(colorArray, screenGridX, screenGridY);

	this.fill = function(color) {
		canvas.fill(color);
		cursorIndex = 0;
		return this;
	}

	// RENDERING

	function setCurrent(top, bottom, topIndex, botIndex) {
		canvas[topIndex] = canvas[botIndex] = 0;
		current[topIndex] = top;
		current[botIndex] = bottom;
	}

	function sendDrawRequest(top, bottom, botIndex) {
		const x = botIndex % bufferWidth;
		const y = Math.floor(botIndex / bufferWidth) - 1;
		const screenX = bufferX + x;
		const screenY = Math.floor((bufferY + y) / 2);
		const pixel = manager.pixel(top, bottom);
		manager.requestDrawNew(bufferId, pixel, screenX, screenY, bufferZ);
	}

	function render(bufferRowIndex, columnIndex) {
		const topIndex = bufferRowIndex + columnIndex;
		const botIndex = topIndex + bufferWidth;
		const top = canvas[topIndex] | 0;
		const bottom = canvas[botIndex] | 0;
		const currentTop = current[topIndex] | 0;
		const currentBottom = current[botIndex] | 0;
		setCurrent(top, bottom, topIndex, botIndex);

		if (top != currentTop || bottom != currentBottom)
			sendDrawRequest(top, bottom, botIndex);
	}

	function paint(bufferRowIndex, columnIndex) {
		const topIndex = bufferRowIndex + columnIndex;
		const botIndex = topIndex + bufferWidth;
		const currentTop = current[topIndex] | 0;
		const currentBottom = current[botIndex] | 0;
		const top = (canvas[topIndex] || currentTop) | 0
		const bottom = (canvas[botIndex] || currentBottom) | 0;
		setCurrent(top, bottom, topIndex, botIndex);

		if (top != currentTop || bottom != currentBottom)
			sendDrawRequest(top, bottom, botIndex);
	}

	function handleRender(renderFunction) {
		if (manager.pauseRenders || this.pauseRenders) return;
		let i = 0 - bufferWidth * (bufferY % 2);
		do { // Loop through buffer
			let j = 0;
			do { // Loop through buffer double row (top & bottom)
				renderFunction(i, j);
				j++;
			} while (j < bufferWidth);
			i += bufferWidth * 2;
		} while (i < bufferSize);
		manager.executeRenderOutput();
	}

	this.render = () => handleRender(render);
	this.paint = () => handleRender(paint);

	this.ghostRender = function() {
		if (!inConstruction && canvasEmpty) return;
		inConstruction = false;
		let i = 0;
		do { // Loop through buffer
			let j = 0;
			do {
				const topIndex = i + j;
				const botIndex = topIndex + bufferWidth;
				const top = canvas[topIndex] | 0;
				const bottom = canvas[botIndex] | 0;
				const currentTop = current[topIndex] | 0;
				const currentBottom = current[botIndex] | 0;
				canvas[topIndex] = canvas[botIndex] = 0;
				current[topIndex] = top;
				current[botIndex] = bottom;

				let enteredConstruction = false;
				if (top != currentTop || bottom != currentBottom) {
					const x = botIndex % bufferWidth;
					const y = Math.floor(botIndex / bufferWidth) - 1;
					const screenX = bufferX + x;
					const screenY = Math.floor((bufferY + y) / 2);
					const pixel = manager.pixel(top, bottom);
					enteredConstruction =
						manager.requestGhostDrawNew(bufferId, pixel, screenX, screenY, bufferZ);
				}
				if (enteredConstruction && !inConstruction) inConstruction = true;
				j++;

			} while (j < bufferWidth);
			i += bufferWidth * 2;
		} while (i < bufferSize);
	}

	this.debugCanvas = (debugX, debugY) => {
		const columnWidth = 15;
		process.stdout.cursorTo(debugX, debugY);
		const hr = '_'.repeat(columnWidth * bufferWidth);
		console.log('\x1b[0m' + hr);
		let i = 0;
		do {
			const x = i % bufferWidth;
			const y = Math.floor(i / bufferWidth);
			const canvasColor = canvas.at(i);
			const currentColor = current.at(i);
			let colorString;
			let numberString = '';
			if (canvasColor) {
				numberString = '\x1b[32m';
				colorString = manager.hexDebugString(canvasColor);
			} else if (currentColor) {
				numberString = '\x1b[31m';
				colorString = manager.hexDebugString(currentColor);
			} else {
				colorString = '       ';
			}
			process.stdout.cursorTo(debugX + x * columnWidth, debugY + 1 + y * 2);
			process.stdout.write('| ' + numberString.concat(i.toString()) + ' '.repeat(i < 10 ? 2 : 1) + colorString);
			if (i % bufferWidth == 0) {
				process.stdout.cursorTo(debugX, debugY + 2 + y * 2);
				process.stdout.write(hr);
			}
			i++;
		} while (i < bufferSize);
		process.stdout.cursorTo(debugX, debugY + bufferHeight * 2 + 2);
		return this;
	}
}

module.exports = PixelDisplayBuffer;
