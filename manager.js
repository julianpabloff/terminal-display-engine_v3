const DisplayBuffer = require('./buffer.js');
const SLL = require('./sll.js');
const log = string => process.stdout.write('\n' + string);

const BufferManager = function() {
	const groups = {};
	const activeGroup = 'main';

	let idIncrement = 0;
	const newId = () => idIncrement++;
	this.createBuffer = function(x, y, width, height, zIndex = 0, group = 'main') {
		if (!groups[group]) groups[group] = new Set();
		const buffer = new DisplayBuffer(x, y, width, height, this, zIndex, group);
		buffer.id = newId();
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
		// screenConstruction and screenCurrent
		let i = 0;
		do { // Set up render data
			renderConstruction.push(new SLL());
			i++;
		} while (i < screenSize);
		// console.log(`render construction took ${Date.now() - start}ms`);
	}
	let screenWidth, screenSize;
	let renderedChar, renderedFg, renderedBg, renderConstruction;

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

	// Color conversion
	const hexToRGB = hex => { return {r: hex >> 16, g: (hex >> 8) & 0xFF, b: hex & 0xFF} };
	const hexToString = hex => {
		const rgb = hexToRGB(hex);
		return '\x1b[38;2;' + rgb.r.toString() + ';' + rgb.g.toString() + ';' + rgb.b.toString() + 'm';
	}
	// 256 color terminals
	const hexTo256Color = hex => {
		const options = [0, 95, 135, 175, 215, 255];
		const findClosest = num => {
			let lastDelta = num;
			let i = 1;
			while (i < 6) {
				const delta = Math.abs(num - options[i]);
				if (delta > lastDelta) return options[i - 1];
				lastDelta = delta;
				i++;
			}
			return options[i - 1];
		}
		const rgb = hexToRGB(hex);
		const closestR = findClosest(rgb.r);
		const closestG = findClosest(rgb.g);
		const closestB = findClosest(rgb.b);
		let code = 16 + 36 * options.indexOf(closestR) + 6 * options.indexOf(closestG) + options.indexOf(closestB);
		if (rgb.r == rgb.g && rgb.r == rgb.b) { // Greyscale specification (last codes of 256 colors)
			const greyOptions = [];
			for (let i = 232; i < 256; i++) greyOptions.push(8 + 10 * (i - 232));
			const currentDelta = Math.abs(rgb.r - closestR);
			let minDelta = currentDelta;
			let mindex = 0;
			let foundSmallerDelta = false;
			for (let i = 0; i < greyOptions.length; i++) {
				const delta = Math.abs(rgb.r - greyOptions[i]);
				if (delta < minDelta) {
					minDelta = delta;
					mindex = i;
					foundSmallerDelta = true;
				} else if (foundSmallerDelta) {
					code = 232 + mindex;
					break;
				}
			}
		}
		return code;
	}
	const fg256ToString = code => '\x1b[38;5;' + code.toString() + 'm';
	const bg256ToString = code => '\x1b[48;5;' + code.toString() + 'm';

	let currentRender = []; // array of strings and ANSI escape codes
	this.createRenderOutput = () => currentRender = [];

	const addToRenderOutput = function(char, fg, bg, x, y) {
		//setTimeout(() => console.log(lastRenderData), 1000);
		const fgChanged = fg != lastRenderData.fg;
		const bgChanged = bg != lastRenderData.bg;
		if (fgChanged || bgChanged) {
			/*
			if (!fg || !bg) currentRender.push(resetColorString);
			if (fgChanged) currentRender.push(fgHexToString(getHex(fg)));
			if (bgChanged) currentRender.push(bgHexToString(getHex(bg)));
			*/
			// 256 color override for mac terminal development... IT WORKS!
			if (!fg || !bg) currentRender.push(resetColorString);
			if (fgChanged) currentRender.push(fg256ToString(hexTo256Color(getHex(fg))));
			if (bgChanged) currentRender.push(bg256ToString(hexTo256Color(getHex(bg))));
		}
		const moveCursorNecessary = !(y == lastRenderData.y && x == lastRenderData.x + 1);
		if (moveCursorNecessary) currentRender.push(moveCursorString(x, y));
		currentRender.push(String.fromCharCode(char));
		lastRenderData = { x: x, y: y, fg: fg, bg: bg };
	}

	const hexDebugString = color => {
		if (!color) return '[none]';
		const hex = getHex(color);
		const ANSI = fg256ToString(hexTo256Color(hex));
		return ANSI + '#' + getHex(color).toString(16) + resetColorString;
	};

	this.requestDraw = function(char, fg, bg, x, y, id, zIndex) {
		console.log('requesting draw for buffer #' + id);
		const charDebugString = `char: ${char} (${String.fromCharCode(char)})`;
		const fgDebugString = ` fg: #${getHex(fg).toString(16)}(${getOpacity(fg)})`;
		const bgDebugString = ` bg: #${getHex(bg).toString(16)}(${getOpacity(bg)})`;
		const charDebugArray = ['char:', char, '(' + String.fromCharCode(char) + ')'];
		const fgDebugArray = ['fg:', hexDebugString(fg), getOpacity(fg)];
		const bgDebugArray = ['bg:', hexDebugString(bg), getOpacity(bg)];
		//console.log(charDebugString + fgDebugString + bgDebugString);
		console.log(...charDebugArray, ...fgDebugArray, ...bgDebugArray);
		console.log('x', x, 'y', y);

		const screenIndex = y * screenWidth + x;
		const datapoint = renderConstruction[screenIndex];
		datapoint.addSorted(id, zIndex, {
			char: char, fg: fg, bg: bg, bufferId: id, zIndex: zIndex
		});

		let outputChar = 32;
		let outputFg = 0;
		let outputBg = 0;
		let fgStack = [];
		let bgStack = [];
		let fgOpacityAConcern = false;
		let bgOpacityAConcern = false;
		console.log();
		datapoint.forEach(item => {
			for (const key of Object.keys(item)) {
				const logArray = ['   ', key];
				const value = item[key];
				if (key == 'fg' || key == 'bg') {
					logArray.push(hexDebugString(value), getOpacity(value));
				} else logArray.push(value);
				console.log(...logArray);
			}
			console.log();
			
			const fg = item.fg;
			const bg = item.bg;
			if (item.char == 32) {
			
			} else if (fg) { // only render the char if there's a fg
				outputChar = item.char;
				if (getOpacity(fg) < 100) {
					if (!fgOpacityAConcern) fgOpacityAConcern = true;
				} else {
					fgStack = [];
					fgOpacityAConcern = false;
				}
				if (fgOpacityAConcern) fgStack.push(fg);
				outputFg = fg;
			}
			outputBg = bg;
		});
		const fgStackDebugArray = [];
		fgStack.forEach(fg => fgStackDebugArray.push(hexDebugString(fg), getOpacity(fg)));
		console.log('fgStack', ...fgStackDebugArray);
		console.log('bgStack', bgStack);
		console.log();
		console.log('outputChar', outputChar);
		if (fgOpacityAConcern) console.log('outputFg [TO BE DETERMINED]');
		else console.log('outputFg', hexDebugString(outputFg));
		if (bgOpacityAConcern) console.log('outputBg [TO BE DETERMINED]');
		else console.log('outputBg', hexDebugString(outputBg));

		//addToRenderOutput(char, fg, bg, x, y);
		console.log();
	};
	this.executeRenderOutput = function() {
		//console.clear();
		//process.stdout.write(currentRender.join(''));
		//process.stdout.cursorTo(1, 3);
		//const datapoint = renderConstruction[2 * screenWidth + 10];
		//renderConstruction[2 * screenWidth + 10].log();
		//console.log();
		//console.log('render output: ', currentRender, '\n\n');
	}

	this.setSize();
}

module.exports = BufferManager;
