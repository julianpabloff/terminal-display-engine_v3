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
		// screenConstruction and screenCurrent
		screenCodes = new Uint16Array(screenSize);
		screenFGs = new Uint32Array(screenSize);
		screenBGs = new Uint32Array(screenSize);
		screenConstruction = [];
		let i = 0;
		do { // Set up render data
			screenConstruction.push(new SLL());
			i++;
		} while (i < screenSize);
		// console.log(`render construction took ${Date.now() - start}ms`);
	}
	let screenWidth, screenSize;
	let renderedChar, renderedFg, renderedBg, screenConstruction;

	// Colors
	// 0000 0000 0000 0000 0000 0000 0000 0000
	// [opacity] [       24 bit color        ]
	const getOpacity = code => code >> 24;
	const getHex = code => code & 0xffffff;
	const getRGBA = code => {
		const hex = getHex(code);
		return { r: hex >> 16, g: (hex >> 8) & 0xFF, b: hex & 0xFF, a: getOpacity(code) };
	};
	// meant to take in decimal values of RGB during opacity calculations
	const setRGBA = rgba => (Math.round(rgba.a) << 24) + (Math.round(rgba.r) << 16) + (Math.round(rgba.g) << 8) + Math.round(rgba.b);

	this.fg = 0;
	this.bg = 0;
	let consoleRenderData = { x: null, y: null, fg: 0, bg: 0 };

	this.setFg = colorCode => this.fg = colorCode;
	this.setBg = colorCode => this.bg = colorCode;
	this.setColor = (fgCode, bgCode) => { this.fg = fgCode; this.bg = bgCode };
	// For use out in the codebase. A whole code must be inputed, and this makes it more convenient
	this.hex = (hex, opacity = 100) => hex + (opacity << 24);
	this.rgba = (r, g, b, a = 100) => (a << 24) + (r << 16) + (g << 8) + b;

	const hexToRGB = hex => { return {r: hex >> 16, g: (hex >> 8) & 0xFF, b: hex & 0xFF} };
	const rgbToHex = (r, g, b) => (r << 16) + (g << 8) + b;
	const fgHexToString = hex => '\x1b[38;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const bgHexToString = hex => '\x1b[48;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const resetColorString = '\x1b[0m';
	const moveCursorString = (x, y) => '\x1b[' + (y + 1).toString() + ';' + (x + 1).toString() + 'H';

	// Color conversion
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
		const fgChanged = fg != consoleRenderData.fg;
		const bgChanged = bg != consoleRenderData.bg;
		if (fgChanged || bgChanged) {
			if (!getOpacity(bg)) currentRender.push(resetColorString);
			if (fgChanged && getOpacity(fg)) currentRender.push(fgHexToString(getHex(fg)));
			if (bgChanged && getOpacity(bg)) currentRender.push(bgHexToString(getHex(bg)));
		}
		const moveCursorNecessary = !(y == consoleRenderData.y && x == consoleRenderData.x + 1);
		if (moveCursorNecessary) currentRender.push(moveCursorString(x, y));
		currentRender.push(String.fromCharCode(char));
		consoleRenderData = { x: x, y: y, fg: fg, bg: bg };
	}

	const hexDebugString = color => {
		if (!color) return '[none]';
		const hex = getHex(color);
		const ANSI = fgHexToString(hex);
		const hexString = hex.toString(16);
		return ANSI + '#' + '0'.repeat(6 - hexString.length) + hexString + resetColorString;
	};

	this.requestDraw = function(char, fg, bg, x, y, id, zIndex) {
		const screenIndex = y * screenWidth + x;
		const datapoint = screenConstruction[screenIndex];
		datapoint.addSorted(id, zIndex, {
			char: char, fg: fg, bg: bg, bufferId: id, zIndex: zIndex
		});

		let outputChar = 32;
		let outputFg = 0;
		let outputBg = 0;
		let fgStackIndex = null;
		let bgStack = [];
		let fgOpacityAConcern = false;
		let bgOpacityAConcern = false;

		let index = 0;
		datapoint.forEach(item => {
			const char = item.char;
			const fg = item.fg;
			const bg = item.bg;
			if (getOpacity(bg)) {
				// if (!outputChar) outputChar = 32;
				if (getOpacity(bg) == 100) {
					bgStack = [bg];
					fgStackIndex = null;
					fgOpacityAConcern = false;
					outputFg = 0;
					bgOpacityAConcern = false;
				} else if (!bgOpacityAConcern) {
					if (!bgStack.length) bgStack.push(100 << 24);
					bgOpacityAConcern = true;
				}
				if (bgOpacityAConcern) {
					bgStack.push(bg);
					index++;
				}
			}
			if (char != 32 && getOpacity(fg)) { // only render the char if the fg shows
				fgStackIndex = index;
				fgOpacityAConcern = getOpacity(fg) < 100;
				outputFg = fg;
				outputChar = char;
			}
		});

		// these layering algos assume the bottom opacity is 100, or else what would the top color fade to?
		const layerColorsHex = function(topHex, opacity, bottomHex) {
			const topRGB = hexToRGB(topHex);
			const bottomRGB = hexToRGB(bottomHex);
			const calcOpacityDelta = (top, bottom) => Math.floor((bottom - top) * (100 - opacity) / 100);
			return rgbToHex(
				topRGB.r + calcOpacityDelta(topRGB.r, bottomRGB.r),
				topRGB.g + calcOpacityDelta(topRGB.g, bottomRGB.g),
				topRGB.b + calcOpacityDelta(topRGB.b, bottomRGB.b)
			);
		}
		// meant to be used repeatedly over the hex algo above, since this one doesn't round
		const layerColorsRGBA = function(topRGBA, bottomRGBA) {
			const opacity = topRGBA.a;
			const calcOpacityDelta = (top, bottom) => (bottom - top) * (100 - opacity) / 100;
			return {
				r: topRGBA.r + calcOpacityDelta(topRGBA.r, bottomRGBA.r),
				g: topRGBA.g + calcOpacityDelta(topRGBA.g, bottomRGBA.g),
				b: topRGBA.b + calcOpacityDelta(topRGBA.b, bottomRGBA.b),
				a: 100
			}
		}

		if (bgOpacityAConcern) {
			outputBg = bgStack[0];
			let outputFgRGBA = getRGBA(outputFg);
			let outputBgRGBA = getRGBA(outputBg);
			let coverFgWithBg = false;
			const insertFgIntoOpacityCalc = function() {
				outputFgRGBA = layerColorsRGBA(getRGBA(outputFg), outputBgRGBA);
				coverFgWithBg = true;
			}
			if (fgStackIndex == 0) insertFgIntoOpacityCalc();
			let i = 1;
			do { // loop through bgStack
				const currentBgRGBA = getRGBA(bgStack[i]);
				outputBgRGBA = layerColorsRGBA(currentBgRGBA, outputBgRGBA);
				if (coverFgWithBg) outputFgRGBA = layerColorsRGBA(currentBgRGBA, outputFgRGBA);
				if (i == fgStackIndex) insertFgIntoOpacityCalc();
				i++;
			} while (i < bgStack.length);
			outputFg = setRGBA(outputFgRGBA);
			outputBg = setRGBA(outputBgRGBA);
		} else {
			if (bgStack[0]) outputBg = bgStack[0];
			if (fgOpacityAConcern) outputFg = this.hex(layerColorsHex(getHex(outputFg), getOpacity(outputFg), getHex(outputBg)));
		}

		let screenChanged = screenCodes[screenIndex] != outputChar || screenFGs[screenIndex] != outputFg || screenBGs[screenIndex] != outputBg
		if (screenChanged) {
			addToRenderOutput(outputChar, outputFg, outputBg, x, y);
		}
		screenCodes[screenIndex] = outputChar;
		screenFGs[screenIndex] = outputFg;
		screenBGs[screenIndex] = outputBg;
	}

	this.executeRenderOutput = function() {
		// console.log(currentRender);
		process.stdout.write(currentRender.join(''));
	}

	this.setSize();








	this.requestDrawDebug = function(char, fg, bg, x, y, id, zIndex) {
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
		const datapoint = screenConstruction[screenIndex];
		datapoint.addSorted(id, zIndex, {
			char: char, fg: fg, bg: bg, bufferId: id, zIndex: zIndex
		});

		let outputChar = 32;
		let outputFg = 0;
		let outputBg = 0;
		let fgStackIndex = null;
		let bgStack = [];
		let fgOpacityAConcern = false;
		let bgOpacityAConcern = false;
		console.log();
		let index = 0;
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
			
			const char = item.char;
			const fg = item.fg;
			const bg = item.bg;
			if (getOpacity(bg)) {
				// if (!outputChar) outputChar = 32;
				if (getOpacity(bg) == 100) {
					bgStack = [bg];
					fgStackIndex = null;
					fgOpacityAConcern = false;
					outputFg = 0;
					bgOpacityAConcern = false;
				} else if (!bgOpacityAConcern) {
					if (!bgStack.length) bgStack.push(100 << 24);
					bgOpacityAConcern = true;
				}
				if (bgOpacityAConcern) {
					bgStack.push(bg);
					index++;
				}
			}
			if (char != 32 && getOpacity(fg)) { // only render the char if the fg shows
				fgStackIndex = index;
				fgOpacityAConcern = getOpacity(fg) < 100;
				outputFg = fg;
				outputChar = char;
			}
		});
		console.log('fgStackIndex', fgStackIndex);
		const bgStackDebugArray = [];
		bgStack.forEach(bg => bgStackDebugArray.push(hexDebugString(bg), getOpacity(bg)));
		console.log('bgStack', ...bgStackDebugArray);

		// these layering algos assume the bottom opacity is 100, or else what would the top color fade to?
		const layerColorsHex = function(topHex, opacity, bottomHex) {
			const topRGB = hexToRGB(topHex);
			const bottomRGB = hexToRGB(bottomHex);
			const calcOpacityDelta = (top, bottom) => Math.floor((bottom - top) * (100 - opacity) / 100);
			return rgbToHex(
				topRGB.r + calcOpacityDelta(topRGB.r, bottomRGB.r),
				topRGB.g + calcOpacityDelta(topRGB.g, bottomRGB.g),
				topRGB.b + calcOpacityDelta(topRGB.b, bottomRGB.b)
			);
		}
		// meant to be used repeatedly over the hex algo above, since this one doesn't round
		const layerColorsRGBA = function(topRGBA, bottomRGBA) {
			const opacity = topRGBA.a;
			const calcOpacityDelta = (top, bottom) => (bottom - top) * (100 - opacity) / 100;
			return {
				r: topRGBA.r + calcOpacityDelta(topRGBA.r, bottomRGBA.r),
				g: topRGBA.g + calcOpacityDelta(topRGBA.g, bottomRGBA.g),
				b: topRGBA.b + calcOpacityDelta(topRGBA.b, bottomRGBA.b),
				a: 100
			}
		}

		if (bgOpacityAConcern) {
			outputBg = bgStack[0];
			let outputFgRGBA = getRGBA(outputFg);
			let outputBgRGBA = getRGBA(outputBg);
			let coverFgWithBg = false;
			console.log('starting background:', hexDebugString(outputBg), outputBgRGBA);
			const insertFgIntoOpacityCalc = function() {
				outputFgRGBA = layerColorsRGBA(getRGBA(outputFg), outputBgRGBA);
				outputFg = setRGBA(outputFgRGBA);
				console.log(' └─> fg layering:   ', hexDebugString(outputFg), outputFgRGBA);
				coverFgWithBg = true;
			}
			if (fgStackIndex == 0) insertFgIntoOpacityCalc();
			let i = 1;
			do { // loop through bgStack
				const currentBgRGBA = getRGBA(bgStack[i]);
				outputBgRGBA = layerColorsRGBA(currentBgRGBA, outputBgRGBA);
				outputBg = setRGBA(outputBgRGBA);
				console.log('└──> combination:   ', hexDebugString(bgStack[i]), currentBgRGBA);
				console.log('output background:  ', hexDebugString(outputBg), outputBgRGBA);
				if (coverFgWithBg) {
					outputFgRGBA = layerColorsRGBA(currentBgRGBA, outputFgRGBA);
					outputFg = setRGBA(outputFgRGBA);
					console.log(' └─> fg covering:   ', hexDebugString(outputFg), outputFgRGBA);
				}
				if (i == fgStackIndex) insertFgIntoOpacityCalc();
				i++;
			} while (i < bgStack.length);
		} else {
			if (bgStack[0]) outputBg = bgStack[0];
			if (fgOpacityAConcern) outputFg = this.hex(layerColorsHex(getHex(outputFg), getOpacity(outputFg), getHex(outputBg)));
		}

		console.log();
		console.log('outputChar', outputChar);
		console.log('outputFg', hexDebugString(outputFg), getOpacity(outputFg), 'calculated:', fgOpacityAConcern);
		console.log('outputBg', hexDebugString(outputBg), getOpacity(outputBg), 'calculated:', bgOpacityAConcern);
		const fgANSI = getOpacity(outputFg) ? fgHexToString(getHex(outputFg)) : resetColorString;
		const bgANSI = getOpacity(outputBg) ? bgHexToString(getHex(outputBg)) : resetColorString + fgANSI;
		console.log('\n' + fgANSI + bgANSI + '    ' + String.fromCharCode(outputChar).repeat(4) + '    ' + resetColorString);
		console.log();

	}
}

module.exports = BufferManager;
