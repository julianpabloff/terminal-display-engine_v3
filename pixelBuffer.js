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

	// Keep track of indeces so you don't have to loop through the entire buffer
	const canvasIndeces = new Set();
	const currentIndeces = new Set();

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

	this.wrap = false;
	this.opacity = 100;

	// this.write(red, 15);
	// this.write([red, yellow, green, cyan]);
	this.write = function(colorInput, count = 1) {
		let i = 0;
		let getColor, amount;
		if (typeof(colorInput) == 'number') { // this.write(color, count);
			getColor = () => colorInput;
			amount = count;
		} else { // this.write(colorArray) [ignore count]
			getColor = () => colorInput.at(i);
			amount = colorInput.length;
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
	
	// this.draw(red, 3, 4, 15);
	// this.draw([red, yellow, green, cyan], 3, 4);
	this.draw = function(colorInput, x, y, count = 1) {
		let index;
		let i = 0;
		const print = color => {
			if (this.wrap) index = coordinateIndex(x, y) + i;
			else index = coordinateIndex(x + i, y);
			if (index != null) {
				canvas[index] = color;
				cursorIndex = index + 1;
			}
			i++;
		}
		if (typeof(colorInput) == 'number') {
			do print(colorInput);
			while (i < count);
		} else {
			const colorCount = colorInput.length;
			do print(colorInput.at(i));
			while (i < colorCount);
		}
		return this;
	}


	this.debugCanvas = (debugX, debugY) => {
		const columnWidth = 15;
		process.stdout.cursorTo(debugX, debugY);
		const hr = '_'.repeat(columnWidth * width);
		console.log('\x1b[0m' + hr);
		let i = 0;
		do {
			const x = i % width;
			const y = Math.floor(i / width);
			process.stdout.cursorTo(debugX + x * columnWidth, debugY + 1 + y * 2);
			process.stdout.write('| ' + i.toString() + ' ' + manager.hexDebugString(canvas.at(i)) + '    ');
			if (i % width == 0) {
				process.stdout.cursorTo(debugX, debugY + 2 + y * 2);
				process.stdout.write(hr);
			}
			i++;
		} while (i < bufferSize);
	}
}

module.exports = PixelDisplayBuffer;
