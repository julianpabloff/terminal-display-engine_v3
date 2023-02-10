const DisplayBuffer = require('./buffer.js');

const BufferManager = function() {
	const groups = {};
	const activeGroup = 'main';

	this.createBuffer = function(x, y, width, height, zIndex = 0, group = 'main') {
		if (!groups[group]) groups[group] = new Set();
		const buffer = new DisplayBuffer(x, y, width, height, this, zIndex, group);
		groups[group].add(buffer);
		return buffer;
	}

	this.setSize = function() {
		screenWidth = process.stdout.columns;
		screenSize = screenWidth * process.stdout.rows;
		renderedChar = new Uint16Array(screenSize);
		renderedFg = new Uint32Array(screenSize);
		renderedBg = new Uint32Array(screenSize);
		const start = Date.now();
		renderConstruction = [];
		let i = 0;
		do { // Set up render data
			// for (let j = 0; j < 3; j++) continue;
			renderConstruction.push({ char: [], fg: [], bg: [], });
			i++;
		} while (i < screenSize);
		// console.log(`render construction took ${Date.now() - start}ms`);
	}
	let screenWidth, screenSize;
	let renderedChar, renderedFg, renderedBg, renderConstruction;
	this.setSize();

	// Colors
	// 0000 0000 0000 0000 0000 0000 0000 0000
	// [opacity] [       24 bit color        ]
	const getOpacity = code => code >> 24;
	const getHex = code => code & 0xffffff;

	this.fg = 0;
	this.bg = 0;
	let lastRenderData = { x: null, y: null, fg: 0, bg: 0 };

	this.setFg = colorCode => this.fg = colorCode;
	this.setBg = colorCode => this.bg = colorCode;
	this.setColor = (fgCode, bgCode) => { this.fg = fgCode; this.bg = bgCode };
	// For use out in the codebase. A whole code must be inputed, and this makes it more convenient
	this.hex = (hex, opacity = 100) => hex + (opacity << 24);
	this.rgba = (r, g, b, a = 100) => (a << 24) + (r << 16) + (g << 8) + b;

	const fgHexToString = hex => '\x1b[38;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const bgHexToString = hex => '\x1b[48;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const resetColorString = '\x1b[0m';
	const moveCursorString = (x, y) => '\x1b[' + (y + 1).toString() + ';' + (x + 1).toString() + 'H';

	let currentRender = []; // array of strings and ANSI escape codes
	this.createRenderOutput = () => currentRender = [];

	const addToRenderOutput = function(char, fg, bg, x, y) {
		// console.log(lastRenderData);
		const fgChanged = fg != lastRenderData.fg;
		const bgChanged = bg != lastRenderData.bg;
		if (fgChanged || bgChanged) {
			if (!fg || !bg) currentRender.push(resetColorString);
			if (fgChanged) currentRender.push(fgHexToString(getHex(fg)));
			if (bgChanged) currentRender.push(bgHexToString(getHex(bg)));
		}
		const moveCursorNecessary = !(lastRenderData.y == y && lastRenderData.x == x - 1);
		if (moveCursorNecessary) currentRender.push(moveCursorString(x, y));
		currentRender.push(String.fromCharCode(char));
		lastRenderData = { x: x, y: y, fg: fg, bg: bg };
	}

	const reportConstructionInArea = function(x, y, w, h) {
		// const buffers = groups[activeGroup].values();
		// const firstBuffer = buffers.next().value;
		// const x = firstBuffer.x;
		// const y = firstBuffer.y;
		for (let i = 0; i < h; i++) {
			for (let j = 0; j < w; j++) {
				const screenX = x + j;
				const screenY = y + i;
				const screenIndex = screenY * screenWidth + screenX;
				console.log('x: ' + screenX + ', y: ' + screenY + ' index: ' + screenIndex);
				console.log(renderConstruction.at(screenIndex));
				console.log('-------');
			}
		}
	}

	this.requestDraw = function(char, fg, bg, x, y, zIndex) {
		addToRenderOutput(char, fg, bg, x, y);
		const screenIndex = y * screenWidth + x;
		const construction = renderConstruction.at(screenIndex);
		const charConstruction = construction.char;
		if (!charConstruction.length)
			charConstruction.push(char);
	};
	this.executeRenderOutput = function() {
		process.stdout.write(currentRender.join(''));
		process.stdout.cursorTo(1, 3);
		console.log(resetColorString);
		console.log(currentRender);
		reportConstructionInArea(10, 2, 5, 1);
	}
}

module.exports = BufferManager;
