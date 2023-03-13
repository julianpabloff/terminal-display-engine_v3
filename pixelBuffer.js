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
				cursorIndex = index + 1;
			}
			i++;
		} while (i < amount);
		return this;
	}
	
	// TODO
	// this.drawAbsolute(color, screenGridX, screenGridY);
	// this.drawAbsolute(color, count, screenGridX, screenGridY);
	// this.drawAbsolute(colorArray, screenGridX, screenGridY);

	this.fill = function(color) {
		// canvas.fill(color);
		let i = 0;
		do {
			addToCanvas(i, color);
			// canvasIndeces.add(i);
			i++;
		} while (i < bufferSize);
		return this;
	}

	// TODO: Move ASCII block determination logic up to the manager level, to more accurately determine whether to draw a top block
	// or a bottom block, given the bigger picture of the construction. Make a separate mangager.requestPixelDraw() and send a
	// pixel data object with .top and .bottom (cuz BigInt is confusing)
	const topBlockCode = 9600;
	const bottomBlockCode = 9604;
	this.render = function(paint = false) {
		if (manager.pauseRenders || this.pauseRenders) return;
		let i = 0 - bufferWidth * (bufferY % 2);
		do { // Loop through buffer
			let j = 0;
			do {
				const log = [i + j];
				const index = i + j;
				let canvasTop = canvas[index] | 0;
				let canvasBottom = canvas[index + bufferWidth] | 0;
				const currentTop = current[index] | 0;
				const currentBottom = current[index + bufferWidth] | 0;
				canvas[index] = 0;
				canvas[index + bufferWidth] = 0;
				current[index] = canvasTop;
				current[index + bufferWidth] = canvasBottom;

				// TODO: PAINT
				if (paint) {
					// do something clever
				}

				if (canvasTop != currentTop || canvasBottom != currentBottom) {
					let code, fg, bg;
					if (canvasTop) {
						code = topBlockCode;
						fg = canvasTop;
						bg = canvasBottom;
					} else {
						code = bottomBlockCode;
						fg = canvasBottom;
						bg = canvasTop;
					}
					const x = (index + bufferWidth) % bufferWidth;
					const y = Math.floor((index + bufferWidth) / bufferWidth) - 1;
					const screenX = bufferX + x;
					const screenY = Math.floor((bufferY + y) / 2);
					enteredConstruction = manager.requestDraw(code, fg, bg, screenX, screenY, this.id, bufferZ);
				}
				j++;
			} while (j < bufferWidth);
			i += bufferWidth * 2;
		} while (i < bufferSize);
		manager.executeRenderOutput();
	}
	this.paint = () => this.render(true);

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
