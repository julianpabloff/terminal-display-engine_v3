const Node = function(id, index, data) {
	this.id = id;
	this.index = index;
	this.data = data;
	this.next = null;
}
const Construction = function() {
	const addedIDs = new Set();
	let start = { next: null };
	this.length = 0;
	this.addSorted = function(id, index, data) {
		const newNode = new Node(id, index, data);
		let runner = start;
		while (runner.next) {
			// Replaces duplicate instead of adding to the sll
			if (id === runner.next.id) {
				const temp = runner.next.next;
				runner.next = newNode;
				runner.next.next = temp;
				return;
			}
			if (index < runner.next.index) {
				const temp = runner.next;
				runner.next = newNode;
				runner.next.next = temp;
				addedIDs.add(id);
				this.length++;
				
				let sprinter = runner.next.next;
				while (sprinter.next) {
					if (id === sprinter.next.id) {
						sprinter.next = sprinter.next.next;
						this.length--;
						return;
					}
					sprinter = sprinter.next;
				}
				return;
			}
			runner = runner.next;
		}
		runner.next = newNode;
		addedIDs.add(id);
		this.length++;
	}
	this.deleteById = function(id) {
		let runner = start;
		while (runner.next) {
			if (id == runner.next.id) {
				runner.next = runner.next.next;
				this.length--;
				addedIDs.delete(id);
				return;
			}
			runner = runner.next;
		}
	}
	this.findById = function(id) {
		let runner = start;
		while (runner.next) {
			if (id == runner.next.id) {
				return runner.next.data;
			}
			runner = runner.next;
		}
		return false;
	}
	this.has = function(id) {
		return addedIDs.has(id);
	}
	this.forEach = function(callback) {
		let runner = start;
		let index = 0;
		while (runner.next) {
			callback(runner.next.data);
			index++;
			runner = runner.next;
		}
	}

	const getOpacity = code => code >> 24;
	const getHex = code => code & 0xffffff;

	const RGBA = function(r, g, b, a) {
		this.r = r; this.g = g; this.b = b; this.a = a;
	}
	const getRGBA = color => {
		const hex = getHex(color);
		return new RGBA(hex >> 16, (hex >> 8) & 0xff, hex & 0xff, color >> 24);
	};
	const setRGBA = rgba =>
		(Math.round(rgba.a) << 24) +
		(Math.round(rgba.r) << 16) +
		(Math.round(rgba.g) << 8) +
		Math.round(rgba.b);
	const emptyRGBA = new RGBA(0, 0, 0, 0);

	const layerColorsRGBA = (topRGBA, botRGBA) => {
		const opacity = topRGBA.a;
		if (!opacity) return botRGBA;
		if (opacity > 99) return topRGBA;
		const calcOpacityDelta = (top, bottom) => (bottom - top) * (100 - opacity) / 100;
		return new RGBA(
			topRGBA.r + calcOpacityDelta(topRGBA.r, botRGBA.r),
			topRGBA.g + calcOpacityDelta(topRGBA.g, botRGBA.g),
			topRGBA.b + calcOpacityDelta(topRGBA.b, botRGBA.b),
			100
		);
	}
	const blurRGBA = (RGBA1, RGBA2) => {
		if (!RGBA1.a) return RGBA2;
		if (!RGBA2.a) return RGBA1;
		return new RGBA(
			(RGBA1.r + RGBA2.r) / 2,
			(RGBA1.g + RGBA2.g) / 2,
			(RGBA1.b + RGBA2.b) / 2,
			(RGBA1.a + RGBA2.a) / 2,
		);
	}

	this.charOnPixelMethod = 'blur';
	this.determineOutput = function(debug) {
		let outputCode = 32;
		let outputFg = 0;
		let outputBg = 0;
		let fgRGBA, bgRGBA, topRGBA, botRGBA;
		fgRGBA = bgRGBA = topRGBA = botRGBA = emptyRGBA;
		const stackHeight = this.length;
		const topHalfStack = new Uint32Array(stackHeight);
		const botHalfStack = new Uint32Array(stackHeight);

		const calcBgRGBA = bg => {
			switch (this.charOnPixelMethod) {
				case 'blur' : return layerColorsRGBA(getRGBA(bg), blurRGBA(topRGBA, botRGBA));
				case 'top' : return layerColorsRGBA(getRGBA(bg), topRGBA);
				case 'bottom' : return layerColorsRGBA(getRGBA(bg), botRGBA);
			}
		}

		let stackIndex = 0;
		this.forEach(data => {
			if (data.type == 'point') {
				const code = data.code;
				const fg = data.fg;
				const bg = data.bg;
				const fgOpacity = getOpacity(fg);
				const bgOpacity = getOpacity(bg);

				bgRGBA = calcBgRGBA(bg);
				if (bgOpacity) {
					const currentBgRGBA = getRGBA(bg);
					if (bgOpacity > 99) { // Full opacity
						outputCode = 32;
						outputFg = 0;
						outputBg = bg;
					} else if (code == 32) // Layer background on top of foreground
						fgRGBA = layerColorsRGBA(currentBgRGBA, fgRGBA);
					topRGBA = layerColorsRGBA(currentBgRGBA, topRGBA);
					botRGBA = layerColorsRGBA(currentBgRGBA, botRGBA);
					topHalfStack[stackIndex] = botHalfStack[stackIndex] = bg;
				}
				if (code != 32 && fgOpacity) {
					outputCode = code;
					fgRGBA = layerColorsRGBA(getRGBA(fg), bgRGBA);
				}
			} else if (data.type == 'pixel') {
				const top = data.top;
				const bottom = data.bottom;
				const topOpacity = getOpacity(top);
				const botOpacity = getOpacity(bottom);
				topHalfStack[stackIndex] = top;
				botHalfStack[stackIndex] = bottom;
				if (topOpacity || botOpacity) {
					outputCode = 32;
					fgRGBA = bgRGBA = emptyRGBA;
				}
				topRGBA = layerColorsRGBA(getRGBA(top), topRGBA);
				botRGBA = layerColorsRGBA(getRGBA(bottom), botRGBA);
			}
			stackIndex++;
		});

		const logStack = stack => {
			const stackLog = [];
			stack.forEach(color => {
				const opacity = getOpacity(color);
				stackLog.push(
					hexDebugString(color),
					getOpacity(color),
					' '.repeat(3 - (opacity > 0) - (opacity == 100))
				)
			});
			return stackLog;
		}

		// Process the stacks here
		if (outputCode == 32) {
			const top = setRGBA(topRGBA);
			const bottom = setRGBA(botRGBA);
			const topBlockCode = 9600;
			const botBlockCode = 9604;
			if (top != bottom) {
				if (top) {
					outputCode = topBlockCode;
					outputFg = top;
					outputBg = bottom;
				} else if (bottom) {
					outputCode = botBlockCode;
					outputFg = bottom;
					outputBg = top;
				}
			} else {
				outputBg = top;
			}
		} else {
			outputFg = setRGBA(fgRGBA);
			outputBg = setRGBA(bgRGBA);
		}
		if (false) {
			process.stdout.cursorTo(debug.x, debug.y);
			console.log('\n');
			debugThis();
			console.log('topStack ', ...logStack(topHalfStack));
			console.log('botStack ', ...logStack(botHalfStack));
			console.log('fg  ', hexDebugString(setRGBA(fgRGBA)), fgRGBA);
			console.log('bg  ', hexDebugString(setRGBA(bgRGBA)), bgRGBA);
			console.log('top ', hexDebugString(setRGBA(topRGBA)), topRGBA);
			console.log('bot ', hexDebugString(setRGBA(botRGBA)), botRGBA);
			console.log('\nevaluating as pixel', outputCode == 32);
			console.log('OUTPUT: code', outputCode, 'fg', hexDebugString(outputFg), 'bg', hexDebugString(outputBg));
			console.log();
		}
		return {
			code: outputCode,
			fg: outputFg,
			bg: outputBg
		}
	}

	// IN THIS SCENARIO...

	// Just the top half of a pixel on top of a char
	//   -->  The char goes away, the top half of the pixel becomes the effective "foreground" color
	//        and the background color gets inherited from below in the bgStack

	// If a pixel is at all on top of a char
	//   -->  The char goes away. The pixel, both the top and the bottom, is effectively a char with
	//        a top and a bottom foreground color

	// A char is on top with pixels underneath, and underneath the top color output is different than the bottom
	//   -->  Default to the top half output color, and make that the background of the char
	//        then layer any clear (code = 32) background colors on top from there

	// Opacity < 100 pixel (top and bottom) on top of a non-space char with a background color
	//   --> The char goes away (outputCode = 32)
	//   --> The background color of the char gets added to the top and bottom stacks, and they both influence the
	//       output color of the pixel

	const fgHexToString = hex => '\x1b[38;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const bgHexToString = hex => '\x1b[48;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const resetString = '\x1b[0m';

	const hexDebugString = color => {
		if (!color) return resetString + '[empty]' + resetString;
		const hex = getHex(color);
		const ANSI = fgHexToString(hex);
		const hexString = hex.toString(16);
		return ANSI + '#' + '0'.repeat(6 - hexString.length) + hexString + resetString;
	};
	const debugThis = function() {
		if (!this.length) {
			console.log('this construction is empty');
			return;
		}
		console.log('construction length', this.length);
		this.forEach(item => {
			for (const key of Object.keys(item)) {
				const logArray = ['   ', key];
				const value = item[key];
				if (key != 'code' && key != 'type') {
					logArray.push(hexDebugString(value), getOpacity(value));
				} else logArray.push(value);
				console.log(...logArray);
			}
			console.log();
		});
	}.bind(this);
}

module.exports = Construction;
