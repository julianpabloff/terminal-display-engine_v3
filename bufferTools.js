const BufferTools = function(manager) {
	// COLOR TOOLS
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
}

module.exports = BufferTools;
