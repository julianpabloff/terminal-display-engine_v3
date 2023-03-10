const PixelEngine = function(manager, buffer) { // Will get rid of manager
	// TODO: Just make another pixel buffer cuz it needs to know everything
	const width = buffer.width;
	const height = buffer.height * 2;
	const size = width * height;

	const grid = new Uint32Array(size); // Top half of pixels in first half of array
	const coordinateIndex = (x, y) => {
		if (x < 0 || x >= width) return null;
		if (y < 0 || y >= height) return null;
		return (y * width) + x;
	}

	// Snaps grid index to the top half of the vertical pixel pair
	const snapGridIndex = index => index - width * (Math.floor(index / width) % 2);
	const gridIndexToBufferIndex = index => Math.floor(index / width / 2) * width + index % width;
	const bufferIndexToGridIndex = index => Math.floor(index / width) * 2 * width + index % width;

	// Maps pending grid indeces to buffer location
	const renderMap = new Map();
	const addGridIndex = index => {
		const snapGrid = snapGridIndex(index);
		const bufferIndex = gridIndexToBufferIndex(index);
		const bufferX = bufferIndex % width;
		const bufferY = Math.floor(bufferIndex / width);
		if (!renderMap.has(snapGrid)) {
			renderMap.set(snapGrid, {x: bufferX, y: bufferY});
		}
	}

	let cursorIndex = 0;
	const bufferWrite = buffer.write;
	buffer.write = function(color, count = 1) {
		const startIndex = cursorIndex;
		const available = width - cursorIndex % width;
		let i = 0;
		do {
			const progress = cursorIndex - startIndex;
			if (!buffer.wrap && progress >= available) break;
			grid[cursorIndex] = color;
			addGridIndex(cursorIndex);
			cursorIndex++;
			if (cursorIndex >= size) {
				cursorIndex = 0;
				break;
			}
			i++;
		} while (i < count);
		return buffer;
	}

	const bufferDraw = buffer.draw;
	buffer.draw = function(color, x, y, count = 1) {
		let index;
		let i = 0;
		do {
			if (buffer.wrap) index = coordinateIndex(x, y) + i;
			else index = coordinateIndex(x + i, y);
			if (index != null) {
				grid[index] = color;
				addGridIndex(index);
				cursorIndex = index + 1;
			}
			i++;
		} while (i < count);
		return buffer;
	}

	const topHalfBlock = '???';
	const bottomHalfBlock = '???';

	const applyGrid = () => {
		renderMap.forEach((bufferLocation, gridIndex) => {
			const topColor = grid.at(gridIndex);
			const bottomColor = grid.at(gridIndex + width);
			console.log(
				gridIndex,
				manager.hexDebugString(topColor),
				manager.hexDebugString(bottomColor),
				'@ x:', bufferLocation.x, 'y:', bufferLocation.y
			);

			let char, fg, bg;
			if (topColor) {
				char = topHalfBlock;
				fg = topColor;
				bg = bottomColor;
			} else {
				char = bottomHalfBlock;
				fg = bottomColor;
				bg = topColor;
			}

			bufferDraw(char, bufferLocation.x, bufferLocation.y, fg, bg);
		});
		console.log(...buffer.getCanavsCodes());
		console.log(...buffer.getCurrentCodes());
		renderMap.clear();
		grid.fill(0);
	}

	const debugGrid = (x, y) => {
		const columnWidth = 15;
		const debugX = x;
		const debugY = y;
		process.stdout.cursorTo(debugX, debugY);
		const hr = '_'.repeat(columnWidth * width);
		console.log('\x1b[0m' + hr);
		let i = 0;
		do {
			const x = i % width;
			const y = Math.floor(i / width);
			process.stdout.cursorTo(debugX + x * columnWidth, debugY + 1 + y * 2);
			process.stdout.write('| ' + i.toString() + ' ' + manager.hexDebugString(grid.at(i)) + '    ');
			if (i % width == 0) {
				process.stdout.cursorTo(debugX, debugY + 2 + y * 2);
				process.stdout.write(hr);
			}
			i++;
		} while (i < size);
	}

	const bufferRender = buffer.render;
	buffer.render = function() {
		debugGrid(0, 6);
		console.log('\n\n');
		applyGrid();
		console.log('\n\n');
		bufferRender();
	}

	buffer.paint = function() {
		debugGrid(0, 6);
		console.log('\n\n');
		applyGrid();
		console.log('\n\n');
		bufferRender(true);
	}
}

module.exports = PixelEngine;
