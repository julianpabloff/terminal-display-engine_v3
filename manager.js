const DisplayBuffer = require('./buffer.js');
const SLL = require('./sll.js');
const log = string => process.stdout.write('\n' + string);

const BufferManager = function() {
	const createdBuffers = [];
	this.createBuffer = function(x, y, width, height, zIndex = 0) {
		const buffer = new DisplayBuffer(x, y, width, height, this, zIndex);
		createdBuffers.push(buffer);
		buffer.id = createdBuffers.length - 1;
		return buffer;
	}

	const setSize = function() {
		screenWidth = process.stdout.columns;
		screenSize = screenWidth * process.stdout.rows;
		const start = Date.now();
		// screenConstruction and screenCurrent
		screenCodes = new Uint16Array(screenSize);
		screenCodes.fill(32); // it's what's actually there, and this matches the empty output of determineConstructionOutput (code: 32, fg: 0, bg: 0)
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
	let screenCodes, screenFGs, screenBGs, screenConstruction;
	setSize();
	const getScreenIndex = (x, y) => y * screenWidth + x;

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

	const pendingBufferIds = new Set(); // when a buffer adds to its canvas, add its id to this set, remove when buffer.render()
	this.registerToPending = bufferId => pendingBufferIds.add(bufferId);

	const hexDebugString = color => {
		if (!color) return '[none]';
		const hex = getHex(color);
		const ANSI = fgHexToString(hex);
		const hexString = hex.toString(16);
		return ANSI + '#' + '0'.repeat(6 - hexString.length) + hexString + resetColorString;
	};

	// Lists all the DrawObjects on a construction SLL
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
				if (key == 'pointData') {
					console.log('    point data:');
					for (const nestedKey of Object.keys(value)) {
						const nestedLogArray = ['     ', nestedKey];
						const nestedValue = value[nestedKey];
						if (nestedKey != 'code') nestedLogArray.push(hexDebugString(nestedValue), getOpacity(nestedValue));
						else nestedLogArray.push(nestedValue);
						console.log(...nestedLogArray);
					}
					continue;
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

	// TODO: fix bug where fg color underneath surfaces when covered with a 100% opacity background
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
		}

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
		const construction = screenConstruction.at(screenIndex);

		if (code) construction.addSorted(id, zIndex, new PointData(code, fg, bg));
		else construction.deleteById(id);

		return construction;
	}

	this.requestDraw = function(code, fg, bg, x, y, id, zIndex) {
		const construction = this.applyToConstruction(...arguments);
		const determinedOutput = determineConstructionOutput(construction);
		addToCurrentRender(determinedOutput, x, y);
	}

	// If execute was triggered by a buffer.render(), remove buffer.id from pendingBufferIds
	this.executeRenderOutput = function(triggerBufferId = null) {
		console.log(currentRender);
		// process.stdout.write(currentRender.join(''));
		currentRender = [];
		if (triggerBufferId != null) pendingBufferIds.delete(triggerBufferId);
		else pendingBufferIds.clear();
	}

	// TODO: make this.handleResize()
	// TODO: make this like massRender(), where you just iterate through every pending buffer, instead of the screen, use ghostRender() again
	// maybe even just ignore persistence and use massRender() for handling resize, too
	// might be able to get rid of the pending variable
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
					const drawObject = new DrawObject(pointData, id, zIndex);
					construction.addSorted(id, zIndex, drawObject);
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

	// Steps:
	//   - setSize()
	this.handleResize = function() {
		setSize();
		const affectedLocations = new Set();
		for (const buffer of createdBuffers) {
			const bufferLocations = buffer.ghostRender(screenWidth);
		}
	}

	// Renders all buffers' canvases simulateously, used for 'screen switching'
	// Skips buffers with persistent = true, great for background layers that would stay the same
	this.massRender = function() {
		const start = Date.now();
		const affectedLocations = new Set();
		console.log(createdBuffers);
		for (const buffer of createdBuffers) {
			if (buffer.persistent) continue;
			const bufferLocations = buffer.ghostRender(screenWidth);
			for (const index of bufferLocations) affectedLocations.add(index);
		}
		affectedLocations.forEach(screenIndex => {
			const construction = screenConstruction.at(screenIndex);
			const determinedOutput = determineConstructionOutput(construction);
			const x = screenIndex % screenWidth;
			const y = Math.floor(screenIndex / screenWidth);
			addToCurrentRender(determinedOutput, x, y);
		});
		const time = Date.now() - start;
		// setTimeout(() => { console.log('render took', time, 'ms')}, 500);
		this.executeRenderOutput();
	}

	this.clearScreen = function() { // The manager needs to know when the screen is cleared
		process.stdout.write(resetColorString + '\x1b[2J' + '\x1b[?25l');
		process.stdout.cursorTo(0, 0);
		consoleRenderData = { x: null, y: null, fg: 0, bg: 0 };
		screenCodes.fill(32);
		screenFGs = new Uint32Array(screenSize);
		screenBGs = new Uint32Array(screenSize);
	}






	// OLD FUNCTIONS
	const addToRenderOutput = function(code, fg, bg, x, y) {
		const fgChanged = fg != consoleRenderData.fg;
		const bgChanged = bg != consoleRenderData.bg;
		if (fgChanged || bgChanged) {
			if (!getOpacity(bg)) currentRender.push(resetColorString);
			if (fgChanged && getOpacity(fg)) currentRender.push(fgHexToString(getHex(fg)));
			if (bgChanged && getOpacity(bg)) currentRender.push(bgHexToString(getHex(bg)));
		}
		const moveCursorNecessary = !(y == consoleRenderData.y && x == consoleRenderData.x + 1);
		if (moveCursorNecessary) currentRender.push(moveCursorString(x, y));
		currentRender.push(String.fromCharCode(code));
		consoleRenderData = { x: x, y: y, fg: fg, bg: bg };
	}

	this.requestDrawOld = function(char, fg, bg, x, y, id, zIndex) {
		const screenIndex = y * screenWidth + x;
		const datapoint = screenConstruction.at(screenIndex);
		const drawObject = { char: char, fg: fg, bg: bg, bufferId: id, zIndex: zIndex };
		if (char) datapoint.addSorted(id, zIndex, drawObject);
		else datapoint.deleteById(id);

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
					outputFg = 0;
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
			return (100 << 24) + rgbToHex(
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
			outputBg = bgStack.at(0);
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
				const currentBgRGBA = getRGBA(bgStack.at(i));
				outputBgRGBA = layerColorsRGBA(currentBgRGBA, outputBgRGBA);
				if (coverFgWithBg) outputFgRGBA = layerColorsRGBA(currentBgRGBA, outputFgRGBA);
				if (i == fgStackIndex) insertFgIntoOpacityCalc();
				i++;
			} while (i < bgStack.length);
			outputFg = setRGBA(outputFgRGBA);
			outputBg = setRGBA(outputBgRGBA);
		} else {
			if (bgStack.at(0)) outputBg = bgStack.at(0);
			if (fgOpacityAConcern) outputFg = layerColorsHex(getHex(outputFg), getOpacity(outputFg), getHex(outputBg));
		}

		let screenChanged =
			screenCodes.at(screenIndex) != outputChar ||
			screenFGs.at(screenIndex) != outputFg ||
			screenBGs.at(screenIndex) != outputBg;

		if (screenChanged) {
			addToRenderOutput(outputChar, outputFg, outputBg, x, y);
		}
		screenCodes[screenIndex] = outputChar;
		screenFGs[screenIndex] = outputFg;
		screenBGs[screenIndex] = outputBg;
	}

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
		const datapoint = screenConstruction.at(screenIndex);
		const drawObject = { char: char, fg: fg, bg: bg, bufferId: id, zIndex: zIndex };
		if (char) datapoint.addSorted(id, zIndex, drawObject);
		else datapoint.deleteById(id);

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
					index = 0;
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
			return (100 << 24) + rgbToHex(
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
			outputBg = bgStack.at(0);
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
				const currentBgRGBA = getRGBA(bgStack.at(i));
				outputBgRGBA = layerColorsRGBA(currentBgRGBA, outputBgRGBA);
				outputBg = setRGBA(outputBgRGBA);
				console.log('└──> combination:   ', hexDebugString(bgStack.at(i)), currentBgRGBA);
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
			if (bgStack.at(0)) outputBg = bgStack.at(0);
			if (fgOpacityAConcern) outputFg = layerColorsHex(getHex(outputFg), getOpacity(outputFg), getHex(outputBg));
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
