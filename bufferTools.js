const BufferTools = function(manager) {
	// COLOR TOOLS
	// 0000 0000 0000 0000 0000 0000 0000 0000
	// [opacity] [       24 bit color        ]
	const getOpacity = code => code >> 24;
	const getHex = code => code & 0xffffff;
	const checkOpacity = opacity => {
		if (opacity < 0) return 0;
		if (opacity > 100) return 100;
		return opacity;
	}

	this.hex = (hex, opacity = 100) => hex + (checkOpacity(opacity) << 24);
	this.rgb = (r, g, b, a = 100) => (checkOpacity(a) << 24) + (r << 16) + (g << 8) + b;

	this.hsv = (h, s, v, opacity = 100) => {
		// r
	}

	// Common colors - add your own!
	const colorPresets = {
		white: 0xffffff,
		gray: 0x808080,
		black: 0,
		red: 0xff0000,
		orange: 0xffa500,
		yellow: 0xffff00,
		green: 0x00ff00,
		cyan: 0x00ffff,
		blue: 0x0000ff,
		magenta: 0xff00ff,
	};

	// e.x. tools.colors.red => 0xff0000 100%, tools.color('red', 60) => 0xff0000 60%
	this.color = (name, opacity = 100) => colorPresets[name] + (opacity << 24);
	this.colors = {};
	for (const name of Object.keys(colorPresets))
		this.colors[name] = this.hex(colorPresets[name]);

	// Random color
	const randomHex = () => {
		const randomPrimary = () => Math.floor(Math.random() * 256);
		return (randomPrimary() << 16) + (randomPrimary() << 8) + randomPrimary();
	}
	this.colors.random = () => this.hex(randomHex());
	this.randomColorAtOpacity = (opacity = 100) => this.hex(randomHex(), opacity);

	// Flips hex portion of color while maintaining opacity
	this.getNegative = color => {
		const negativeHex = 0xffffff - (color & 0xffffff);
		return negativeHex + ((color >> 24) << 24);
	}

	// Output: #ff0000 80%
	const fgHexToString = hex => '\x1b[38;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const bgHexToString = hex => '\x1b[48;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const resetString = '\x1b[0m';
	this.hexDebugString = color => {
		if (!color) return '[empty]';
		const hex = color & 0xffffff;
		const ANSI = fgHexToString(hex);
		const hexString = hex.toString(16);
		const opacity = (color >> 24).toString();
		// return `#${'0'.repeat(6 - hexString.length)}${hexString} ${opacity}%`;
		return ANSI + '#' + '0'.repeat(6 - hexString.length) + hexString + resetString;
	};

	// Generates an array of [count] length of color codes linearly interpolated from [color1] to [color2]
	// [inclusive = false] is for chaining linear gradients, preventing the stop of a grad and start of the next from being duplicated
	const linearGradient = function(color1, color2, count, inclusive) {
		const hex1 = color1 & 0xffffff;
		let r = hex1 >> 16;
		let g = (hex1 >> 8) & 0xff;
		let b = hex1 & 0xff;
		let a = color1 >> 24;
		const output = new Uint32Array(count);

		if (!inclusive) count++;
		const hex2 = color2 & 0xffffff;
		const intervalR = ((hex2 >> 16) - r) / count;
		const intervalG = (((hex2 >> 8) & 0xff) - g) / count;
		const intervalB = ((hex2 & 0xff) - b) / count;
		const intervalA = ((color2 >> 24) - a) / count;

		output[0] = color1;
		let i = 1;
		do { // transform r, g, b, a
			r += intervalR; g += intervalG; b += intervalB; a += intervalA;
			const outputHex = (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b);
			output[i] = outputHex + (a << 24);
			i++;
		} while (i < count - 1);
		if (inclusive) output[count - 1] = color2;
		return output;
	}

	// colorArray = [ red, yellow, green, cyan, blue, magenta ]
	// {inclusive} pastes an extra color at the end, the last color - doesn't affect the color change rate
	const linearGradientMulti = function(colorArray, segmentLength, inclusive) {
		const colorCount = colorArray.length;
		const outputLength = segmentLength * (colorCount - 1) + inclusive;
		const output = new Uint32Array(outputLength);

		let i = 0; let j = 0;
		do { // chain gradients
			const color1 = colorArray.at(i);
			const color2 = colorArray.at(i + 1);

			const grad = linearGradient(color1, color2, segmentLength, false);
			for (const color of grad) {
				output[j] = color;
				j++;
			}
			i++;
		} while (i < colorCount - 1);

		if (inclusive) output[outputLength - 1] = colorArray.at(-1);

		return output;
	}

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

	// If you want to go off of segmentLength
	// If inclusive, count = (colorArray.length - 1) * segmentLength
	// Else count = something that colorArray.length can evenly expand into (3 into 7)
	this.linearGradient = function(colorArray, count, inclusive = true) {
		const output = new Uint32Array(count);
		const lerp = (start, end, t) => (1 - t) * start + t * end;
		const lastIndex = colorArray.length - 1;
		let u = 0;
		let i = 0;
		do {
			u = lerp(0, lastIndex, i / (count - inclusive));
			const index = Math.floor(u);
			const t = u - index;

			const color1 = colorArray.at(index);
			const RGBA1 = getRGBA(color1);
			const color2 = colorArray.at(index + 1);
			const RGBA2 = color2 ? getRGBA(color2) : emptyRGBA;

			const outputRGBA = new RGBA(
				lerp(RGBA1.r, RGBA2.r, t),
				lerp(RGBA1.g, RGBA2.g, t),
				lerp(RGBA1.b, RGBA2.b, t),
				lerp(RGBA1.a, RGBA2.a, t)
			);
			output[i] = setRGBA(outputRGBA);
			// console.log(i, u, index, this.hexDebugString(output.at(i)));
			i++;
		} while (i < count);
		return output;
	}

	this.rainbow = function(length) {
		const rainbowHex = [0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff, 0xff0000];
		const rainbow = rainbowHex.map(hex => this.hex(hex));
		return this.linearGradient(rainbow, length, false);
	}

	// POSITIONING TOOLS
	// TODO: centerHeight doesn't work when it's a pixel buffer, you have to do
	// centerHeight(height / 2) * 2 for it to actually be centered
	// Maybe these should actaully be buffer functions themselves
	this.centerWidth = width => Math.floor(manager.screenWidth() / 2 - width / 2);
	this.centerHeight = height => Math.floor(manager.screenHeight() / 2 - height / 2);

	// BUFFER DRAWING TOOLS
	this.outline = function(buffer, color = manager.fg, doubleLine = false) {
		let sq = {tl: '┌', h: '─', tr: '┐', v: '│', bl: '└', br: '┘'};
		if (doubleLine) sq = {tl: '╔', h: '═', tr: '╗', v: '║', bl: '╚', br: '╝'}

		buffer.draw(sq.tl + sq.h.repeat(buffer.width - 2) + sq.tr, 0, 0, color);
		for (let i = 1; i < buffer.height - 1; i++)
		buffer.draw(sq.v, 0, i, color).draw(sq.v, buffer.end, i, color);
		buffer.draw(sq.bl + sq.h.repeat(buffer.width - 2) + sq.br, 0, buffer.bottom, color);
		return buffer;
	}

	// 0xff0000 0xffff00 0x00ff00 20
	// 0 1    2  3    4   5     6   7     8   9     10
	// 0 25.5 51 76.5 102 127.5 153 178.5 204 229.5 255
	// 00: 255    0
	// 01: 255    25.5
	// 02: 255    51
	// 03: 255    76.5
	// 04: 255    102
	// 05: 255    127.5
	// 06: 255    153
	// 07: 255    178.5
	// 08: 255    204
	// 09: 255    229.5
	// 10: 229.5  255
	// 11: 204
	// 12: 178.5
	// 13: 153
	// 14: 127.5
	// 15: 102
	// 16: 76.5
	// 17: 51
	// 18: 25.5
	// 19: 0
}

module.exports = BufferTools;
