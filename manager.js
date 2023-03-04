const DisplayBuffer = require('./buffer.js');
const SLL = require('./sll.js');
const log = string => process.stdout.write('\n' + string);

const BufferManager = function() {
	const clearScreenString = '\x1b[0m\x1b[?25l\x1b[2J\x1b[3J\x1b[1;1H';
	this.init = () => process.stdout.write(clearScreenString);

	const createdBuffers = [];
	this.createBuffer = function(x, y, width, height, zIndex = 0) {
		const buffer = new DisplayBuffer(x, y, width, height, this, zIndex);
		createdBuffers.push(buffer);
		buffer.id = createdBuffers.length - 1;
		return buffer;
	}

	const setSize = () => {
		screenWidth = process.stdout.columns;
		screenHeight = process.stdout.rows;
		screenSize = screenWidth * screenHeight;
		screenCodes = new Uint16Array(screenSize);
		screenCodes.fill(32);
		screenFGs = new Uint32Array(screenSize);
		screenBGs = new Uint32Array(screenSize);
		screenConstruction = [];
		let i = 0;
		do {
			screenConstruction.push(new SLL());
			i++;
		} while (i < screenSize);
	}

	let screenWidth, screenHeight, screenSize;
	let screenCodes, screenFGs, screenBGs, screenConstruction;
	this.screenWidth = () => screenWidth;
	this.screenHeight = () => screenHeight;
	setSize();
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
	const getRGBA = code => {
		const hex = getHex(code);
		return { r: hex >> 16, g: (hex >> 8) & 0xFF, b: hex & 0xFF, a: getOpacity(code) };
	};
	// meant to take in decimal values of RGB during opacity calculations
	const setRGBA = rgba => (Math.round(rgba.a) << 24) + (Math.round(rgba.r) << 16) + (Math.round(rgba.g) << 8) + Math.round(rgba.b);

	this.fadeColor = (color, opacity) => { // fades color to buffer opacity
		const newOpacity = Math.floor(getOpacity(color) * (opacity / 100));
		return getHex(color) + (newOpacity << 24);
	}

	this.fg = (100 << 24) + (255 << 16) + (255 << 8) + 255; // White default
	this.bg = 0;
	let consoleRenderData = { x: null, y: null, fg: 0, bg: 0 };

	this.setFg = colorCode => this.fg = colorCode;
	this.setBg = colorCode => this.bg = colorCode;
	this.setColor = (fgCode, bgCode) => { this.fg = fgCode; this.bg = bgCode };

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

	// Rendering
	let currentRender = []; // array of strings and ANSI escape codes

	const hexDebugString = color => {
		if (!color) return '[none]';
		const hex = getHex(color);
		const ANSI = fgHexToString(hex);
		const hexString = hex.toString(16);
		return ANSI + '#' + '0'.repeat(6 - hexString.length) + hexString + resetColorString;
	};

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
				if (key == 'fg' || key == 'bg') {
					logArray.push(hexDebugString(value), getOpacity(value));
				} else logArray.push(value);
				console.log(...logArray);
			}
			console.log();
		});
	}

	const PointData = function(code, fg, bg) {
		this.code = code;
		this.fg = fg;
		this.bg = bg;
	}
	const DrawObject = function(pointData, bufferId, zIndex) {
		this.pointData = pointData; // PointData
		this.bufferId = bufferId;
		this.zIndex = zIndex;
	}

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

	const addToCurrentRender = function(pointData, x, y) {
		const screenIndex = getScreenIndex(x, y);
		const code = pointData.code;
		const fg = pointData.fg;
		const bg = pointData.bg;

		let screenDifferent =
			screenCodes.at(screenIndex) != code ||
			screenFGs.at(screenIndex) != fg ||
			screenBGs.at(screenIndex) != bg;

		if (screenDifferent) {
			const fgChanged = fg != consoleRenderData.fg;
			const bgChanged = bg != consoleRenderData.bg;
			if (fgChanged || bgChanged) {
				let reset = false;
				if (!getOpacity(bg)) {
					currentRender.push(resetColorString);
					reset = true;
				} else if (bgChanged) currentRender.push(bgHexToString(getHex(bg)));
				if ((fgChanged && getOpacity(fg)) || fg && reset) currentRender.push(fgHexToString(getHex(fg)));
			}
			const moveCursorNecessary = !(y == consoleRenderData.y && x == consoleRenderData.x + 1);
			if (moveCursorNecessary) currentRender.push(moveCursorString(x, y));
			currentRender.push(String.fromCharCode(code));
			consoleRenderData = { x: x, y: y, fg: fg, bg: bg };
		}

		screenCodes[screenIndex] = code;
		screenFGs[screenIndex] = fg;
		screenBGs[screenIndex] = bg;
	}

	this.applyToConstruction = function(code, fg, bg, x, y, id, zIndex) {
		const screenIndex = getScreenIndex(x, y);
		if (screenIndex == null) return null;
		const construction = screenConstruction.at(screenIndex);

		if (code) construction.addSorted(id, zIndex, new PointData(code, fg, bg));
		else construction.deleteById(id);
		return screenIndex;
	}

	this.requestDraw = function(code, fg, bg, x, y, id, zIndex) {
		const screenIndex = this.applyToConstruction(...arguments);
		if (screenIndex == null) return;
		const construction = screenConstruction.at(screenIndex);
		const determinedOutput = determineConstructionOutput(construction);
		addToCurrentRender(determinedOutput, x, y);
	}

	const ghostRenderIndeces = new Set();
	this.requestGhostDraw = function(code, fg, bg, x, y, id, zIndex) {
		const screenIndex = this.applyToConstruction(...arguments);
		if (screenIndex == null) return;
		ghostRenderIndeces.add(screenIndex);
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
			addToCurrentRender(determinedOutput, x, y);
		});
		this.executeRenderOutput();
		ghostRenderIndeces.clear();
	}

	this.massRender = function() {
		if (this.pauseRenders) return;
		for (const buffer of createdBuffers) {
			if (buffer.persistent) continue;
			buffer.ghostRender();
		}
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

	this.handleResize = function() {
		this.clearScreen();
		setSize();
	}

	this.pauseRenders = false;

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

	// this.addToGroup(name, buffer)

	// this.renderGroup(name) => this.massRender(groups[name]);

	// this.renderAll()    Renders all buffers, ignoring persistence
	//                     This is to be called after you call this.clearScreen()

	/* DEPRICATED
	this.createScreenConstruction = function() {
		const start = Date.now();
		screenConstruction = [];
		const pendingBuffers = [];
		pendingBufferIds.forEach(id => pendingBuffers.push(createdBuffers.at(id)));

		let i = 0;
		do { // Loop through the screen
			const construction = new SLL();

			const screenX = i % screenWidth;
			const screenY = Math.floor(i / screenWidth);
			pendingBuffers.forEach(buffer => {
				const bufferIndex = buffer.screenToIndex(screenX, screenY);
				if (bufferIndex != null) {
					const pointData = buffer.canvasLookup(bufferIndex);
					const id = buffer.id;
					const zIndex = buffer.zIndex;
					construction.addSorted(id, zIndex, pointData);
				}
			});
			screenConstruction.push(construction);
			const determinedOutput = determineConstructionOutput(construction);
			addToCurrentRender(determinedOutput, screenX, screenY);
			i++;
		} while (i < screenSize);
		pendingBuffers.forEach(buffer => buffer.transferCanvas());
		const time = Date.now() - start;
		setTimeout(() => { console.log('render took', time, 'ms')}, 500);
		this.executeRenderOutput();
	}
	*/
}

module.exports = BufferManager;
