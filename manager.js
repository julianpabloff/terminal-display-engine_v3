const DisplayBuffer = require('./buffer.js');
const PixelDisplayBuffer = require('./pixelBuffer.js');
const Construction = require('./construction.js');
// const ConstructionManager = require('./construction.js');
// const SLL = require('./sll.js');

const BufferManager = function() {
	// const constructionManager = new ConstructionManager();
	const clearScreenString = '\x1b[0m\x1b[?25l\x1b[2J\x1b[3J\x1b[1;1H';
	this.init = () => process.stdout.write(clearScreenString);

	const createdBuffers = [];
	const createBuffer = function(pixel, x, y, width, height, zIndex) {
		let buffer;
		if (pixel) buffer = new PixelDisplayBuffer(this, x, y, width, height, zIndex);
		else buffer = new DisplayBuffer(this, x, y, width, height, zIndex);
		buffer.id = createdBuffers.length;
		createdBuffers.push(buffer);
		return buffer;
	}.bind(this);
	this.createBuffer = (x, y, width, height, zIndex = 0) => {
		return createBuffer(false, x, y, width, height, zIndex);
	};
	this.createPixelBuffer = (x, y, width, height, zIndex = 0) => {
		return createBuffer(true, x, y, width, height, zIndex);
	};

	const setSize = () => {
		screenWidth = process.stdout.columns;
		screenHeight = process.stdout.rows;
		screenSize = screenWidth * screenHeight;
		screenCodes = new Uint16Array(screenSize);
		screenCodes.fill(32);
		screenFGs = new Uint32Array(screenSize);
		screenBGs = new Uint32Array(screenSize);
		screenConstruction = new Array(screenSize);
		let i = 0;
		do {
			// screenConstruction[i] = new SLL();
			// screenConstruction[i] = constructionManager.create();
			screenConstruction[i] = new Construction();
			i++;
		} while (i < screenSize);
	}
	let screenWidth, screenHeight, screenSize;
	let screenCodes, screenFGs, screenBGs, screenConstruction;
	setSize();

	this.screenWidth = () => screenWidth;
	this.screenHeight = () => screenHeight;

	const getScreenIndex = (x, y) => {
		if (x < 0 || x > screenWidth - 1) return null;
		if (y < 0 || y > screenHeight - 1) return null;
		return y * screenWidth + x;
	}

	// Colors - 32 bit integer
	// 0000 0000 0000 0000 0000 0000 0000 0000
	// [opacity] [       24 bit color        ]
	const getOpacity = code => code >> 24;
	const getHex = code => code & 0xffffff;

	this.fg = (100 << 24) + (255 << 16) + (255 << 8) + 255; // White default
	this.bg = 0;

	this.setFg = colorCode => this.fg = colorCode;
	this.setBg = colorCode => this.bg = colorCode;
	this.setColor = (fgCode, bgCode) => { this.fg = fgCode; this.bg = bgCode };

	this.fadeColor = (color, opacity) => { // fades color to buffer opacity
		const newOpacity = Math.floor(getOpacity(color) * (opacity / 100));
		return getHex(color) + (newOpacity << 24);
	}

	const hexToRGB = hex => { return {r: hex >> 16, g: (hex >> 8) & 0xFF, b: hex & 0xFF} };
	const rgbToHex = (r, g, b) => (r << 16) + (g << 8) + b;
	const resetColorString = '\x1b[0m';
	const moveCursorString = (x, y) => '\x1b[' + (y + 1).toString() + ';' + (x + 1).toString() + 'H';
	const fgHexToString = hex => '\x1b[38;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const bgHexToString = hex => '\x1b[48;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';

	// Color conversion
	// 256 color terminals
	const hexTo256Color = hex => {
		const options = [0, 95, 135, 175, 215, 255];
		const findClosest = num => {
			let lastDelta = num;
			let i = 1;
			while (i < 6) {
				const delta = Math.abs(num - options.at(i));
				if (delta > lastDelta) return options.at(i - 1);
				lastDelta = delta;
				i++;
			}
			return options.at(i - 1);
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
				const delta = Math.abs(rgb.r - greyOptions.at(i));
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

	// 8 color terminals
	const hexToHSV = hex => {
		const rgb = hexToRGB(hex);
		const r = rgb.r / 255;
		const g = rgb.g / 255;
		const b = rgb.b / 255;
		const min = Math.min(r, g, b);
		const max = Math.max(r, g, b);
		const delta = max - min;

		let hue;
		if (delta == 0) hue = 0;
		else if (max == r) hue = 60 * (((g - b) / delta + 6) % 6);
		else if (max == g) hue = 60 * ((b - r) / delta + 2);
		else hue = 60 * ((r - g) / delta + 4);
		const sat = (max == 0) ? 0 : delta / max;
		const val = max;

		return {h: hue, s: sat, v: val};
	}
	const hexTo8Color = hex => {
		const hsv = hexToHSV(hex);
		const hue = hsv.h;
		let color;
		if (hsv.s < 0.15) {
			if (hsv.v < 0.6) color = 1;
			else color = 8;
		}
		else if (hue < 30) color = 2;
		else if (hue < 90) color = 4;
		else if (hue < 150) color = 3;
		else if (hue < 210) color = 7;
		else if (hue < 270) color = 5;
		else if (hue < 330) color = 6;
		else color = 2;
		return color;
	}
	// 1: black, 2: red, 3: green, 4: yellow, 5: blue, 6: magenta, 7: cyan, 8: white
	const fg8ToString = code => '\x1b[' + (29 + code).toString() + 'm';
	const bg8ToString = code => '\x1b[' + (39 + code).toString() + 'm';

	// Rendering
	let currentRender = []; // array of strings and ANSI escape codes
	let consoleRenderData = { x: null, y: null, fg: 0, bg: 0 };

	const PointData = function(code, fg, bg) {
		this.type = 'point';
		this.code = code;
		this.fg = fg;
		this.bg = bg;
	}
	const PixelData = function(top, bottom) {
		this.type = 'pixel';
		this.top = top;
		this.bottom = bottom;
	}
	this.point = (code, fg, bg) => new PointData(code, fg, bg);
	this.pixel = (top, bottom) => new PixelData(top, bottom);

	let colorMode = 0; // 0: 24 bit color, 1: 256 color mode, 2: 8 color mode
	const ansiColorString = [
		{ fg: hex => fgHexToString(hex), bg: hex => bgHexToString(hex) },
		{ fg: hex => fg256ToString(hexTo256Color(hex)), bg: hex => bg256ToString(hexTo256Color(hex)) },
		{ fg: hex => fg8ToString(hexTo8Color(hex)), bg: hex => bg8ToString(hexTo8Color(hex)) }
	];

	const addToCurrentRender = function(pointData, x, y) {
		const code = pointData.code;
		const fg = pointData.fg;
		const bg = pointData.bg;

		const fgChanged = fg != consoleRenderData.fg;
		const bgChanged = bg != consoleRenderData.bg;
		if (fgChanged || bgChanged) {
			let reset = false;
			if (!getOpacity(bg)) {
				currentRender.push(resetColorString);
				reset = true;
			} else if (bgChanged)
				currentRender.push(ansiColorString[colorMode].bg(getHex(bg)));
			if ((fgChanged && getOpacity(fg)) || fg && reset)
				currentRender.push(ansiColorString[colorMode].fg(getHex(fg)));
		}
		const moveCursorNecessary = !(y == consoleRenderData.y && x == consoleRenderData.x + 1);
		if (moveCursorNecessary) currentRender.push(moveCursorString(x, y));
		currentRender.push(String.fromCharCode(code));
		consoleRenderData = { x: x, y: y, fg: fg, bg: bg };
	}

	const requestRender = function(pointData, x, y) {
		const code = pointData.code;
		const fg = pointData.fg;
		const bg = pointData.bg;
		const screenIndex = getScreenIndex(x, y);

		if (
			screenCodes.at(screenIndex) != code ||
			screenFGs.at(screenIndex) != fg ||
			screenBGs.at(screenIndex) != bg
		)
		addToCurrentRender(...arguments);

		screenCodes[screenIndex] = code;
		screenFGs[screenIndex] = fg;
		screenBGs[screenIndex] = bg;
	}

	const flashScreen = function() {
		currentRender.push(resetColorString);
		let i = 0;
		do { // Loop through screen
			const code = screenCodes[i];
			const fg = screenFGs[i];
			const bg = screenBGs[i];
			const x = i % screenWidth;
			const y = Math.floor(i / screenWidth);
			addToCurrentRender(new PointData(code, fg, bg), x, y);
			i++;
		} while (i < screenSize);
	}

	const hexDebugString = color => {
		if (!color) return resetColorString + '[none]' + resetColorString;
		const hex = getHex(color);
		const ANSI = fgHexToString(hex);
		const hexString = hex.toString(16);
		return ANSI + '#' + '0'.repeat(6 - hexString.length) + hexString + resetColorString;
	};
	this.hexDebugString = color => hexDebugString(color);

	/*
	// Lists all the PointData objects in a construction SLL
	const debugConstruction = construction => {
		if (!construction.length) {
			console.log('this construction is empty');
			return;
		}
		console.log('construction length', construction.length);
		construction.forEach(item => {
			for (const key of Object.keys(item)) {
				const logArray = ['   ', key];
				const value = item[key];
				if (key != 'code') {
					logArray.push(hexDebugString(value), getOpacity(value));
				} else logArray.push(value);
				console.log(...logArray);
			}
			console.log();
		});
	}
	*/

	const determineConstructionOutput = construction => {
		let outputCode = 32;
		let outputFg = 0;
		let outputBg = 0;
		let fgStackIndex = null;
		let bgStack = [];
		let fgOpacityAConcern = false;
		let bgOpacityAConcern = false;

		let index = 0;
		construction.forEach(item => { // item:PointData
			const code = item.code;
			const fg = item.fg;
			const bg = item.bg;
			if (getOpacity(bg)) {
				if (getOpacity(bg) == 100) {
					outputCode = 32;
					outputFg = 0;
					bgStack = [bg];
					index = 0;
					fgStackIndex = null;
					fgOpacityAConcern = false;
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
			if (code != 32 && getOpacity(fg)) { // only render the code if the fg shows
				fgStackIndex = index;
				fgOpacityAConcern = getOpacity(fg) < 100;
				outputFg = fg;
				outputCode = code;
			}
		});

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
		const getRGBA = color => {
			const hex = getHex(color);
			return { r: hex >> 16, g: (hex >> 8) & 0xFF, b: hex & 0xFF, a: getOpacity(color) };
		};
		const setRGBA = rgba => (Math.round(rgba.a) << 24) + (Math.round(rgba.r) << 16) + (Math.round(rgba.g) << 8) + Math.round(rgba.b);

		if (bgStack.length) {
			outputBg = bgStack.at(0);
			let outputFgRGBA = getRGBA(outputFg);
			let outputBgRGBA = getRGBA(outputBg);
			if (bgOpacityAConcern) {
				let coverFgWithBg = false;
				const insertFgIntoOpacityCalc = function() {
					outputFgRGBA = layerColorsRGBA(getRGBA(outputFg), outputBgRGBA);
					coverFgWithBg = true;
				}
				if (fgStackIndex == 0) insertFgIntoOpacityCalc();
				let i = 1;
				do { // loop through bgStack
					const currentBgRGBA = getRGBA(bgStack.at(i));
					outputBgRGBA = layerColorsRGBA(currentBgRGBA, outputBgRGBA);
					if (coverFgWithBg) outputFgRGBA = layerColorsRGBA(currentBgRGBA, outputFgRGBA);
					if (i == fgStackIndex) insertFgIntoOpacityCalc();
					i++;
				} while (i < bgStack.length);
				outputFg = setRGBA(outputFgRGBA);
				outputBg = setRGBA(outputBgRGBA);
			} else if (outputFg) {
				outputFgRGBA = layerColorsRGBA(outputFgRGBA, outputBgRGBA);
				outputFg = setRGBA(outputFgRGBA);
			}
		} else if (fgOpacityAConcern) // When there's just a foreground on nothing
			outputFg = setRGBA(layerColorsRGBA(getRGBA(outputFg), getRGBA(100 << 24)));

		return new PointData(outputCode, outputFg, outputBg);
	}

	const applyToConstruction = function(code, fg, bg, screenIndex, id, zIndex) {
		const construction = screenConstruction.at(screenIndex);
		if (code) {
			construction.addSorted(id, zIndex, new PointData(code, fg, bg));
			return true;
		}
		else construction.deleteById(id);
		return false;
	}

	this.requestDraw = function(code, fg, bg, x, y, id, zIndex) {
		const screenIndex = getScreenIndex(x, y);
		if (screenIndex == null) return false;
		const inConstruction = applyToConstruction(code, fg, bg, screenIndex, id, zIndex);
		const construction = screenConstruction.at(screenIndex);
		const determinedOutput = determineConstructionOutput(construction);
		requestRender(determinedOutput, x, y);
		return inConstruction;
	}
	const applyToConstructionNew = function(construction, id, zIndex, data) {
		let add = false;
		if (data instanceof PointData) add = data.code != 0;
		else if (data instanceof PixelData) add = data.top != 0 || data.bottom != 0;
		if (add) construction.addSorted(id, zIndex, data);
		else construction.deleteById(id);
		return add;
	}
	this.requestDrawNew = function(id, data, x, y, zIndex, debug = true) {
		const screenIndex = getScreenIndex(x, y);
		if (screenIndex == null) return false;
		const construction = screenConstruction.at(screenIndex);
		const inConstruction = applyToConstructionNew(construction, id, zIndex, data);
		if (debug) construction.determineOutput();
		// const determinedOutput = constructionManager.determineOutput(construction);
		return inConstruction;
	}

	const ghostRenderIndeces = new Set();
	this.requestGhostDraw = function(code, fg, bg, x, y, id, zIndex) {
		const screenIndex = getScreenIndex(x, y);
		if (screenIndex == null) return false;
		const inConstruction = applyToConstruction(code, fg, bg, screenIndex, id, zIndex);
		ghostRenderIndeces.add(screenIndex);
		return inConstruction;
	}

	this.executeRenderOutput = function() {
		// console.log(currentRender);
		process.stdout.write(currentRender.join(''));
		currentRender = [];
	}

	this.executeGhostRender = function() {
		ghostRenderIndeces.forEach(screenIndex => {
			const construction = screenConstruction.at(screenIndex);
			const determinedOutput = determineConstructionOutput(construction);
			const x = screenIndex % screenWidth;
			const y = Math.floor(screenIndex / screenWidth);
			requestRender(determinedOutput, x, y);
		});
		this.executeRenderOutput();
		ghostRenderIndeces.clear();
	}

	this.massRender = function() {
		if (this.pauseRenders) return;
		for (const buffer of createdBuffers) buffer.ghostRender();
		this.executeGhostRender();
	}

	this.clearScreen = function() { // The manager needs to know when the screen is cleared
		process.stdout.write(clearScreenString);
		consoleRenderData = { x: null, y: null, fg: 0, bg: 0 };
		screenCodes.fill(32);
		screenFGs.fill(0);
		screenBGs.fill(0);
		for (const buffer of createdBuffers) buffer.clearCurrent();
	}

	this.pauseRenders = false;
	this.handleResize = function() {
		this.clearScreen();
		setSize();
	}

	const colorModeNames = ['24 bit', '256 color', '8 color'];
	this.setColorMode = name => {
		colorMode = colorModeNames.indexOf(name);
		flashScreen();
		this.executeRenderOutput();
	}

	// IDEAS

	// this.massRender()    Renders all created buffers, unless the buffer is persistent. Useful
	//                      for "screen switching," switching between groups of buffers while
	//                      keeping other persistent buffers drawn, like a background buffer

	// this.massRender(buffers)    Renders the provided array of buffers, ignoring persistence
	//                             Useful for updating any combination of buffers you want. Like when the
	//                             Solitaire theme changes and you screen swtich to the main menu and update
	//                             the color of the otherwise persistent background buffer too

	// this.createGroup(name, buffers?)    Creates an empty array in the groups object with the
	//                                     key equal to <name>. An array of buffers can be provided,
	//                                     which would take the place of the empty array

	// Since the group items are pointers, a buffer can be a member of any amount of groups

	// this.addToGroup(name, buffer) => groups[name].add(buffer)
	// this.removeFromGroup(name, bufferId)

	// this.renderGroup(name) => this.massRender(groups[name]);

	// this.renderAll()    Renders all buffers, ignoring persistence
	//                     This is to be called after you call this.clearScreen()
}

module.exports = BufferManager;
