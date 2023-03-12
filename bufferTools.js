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
	this.rgba = (r, g, b, a = 100) => (checkOpacity(a) << 24) + (r << 16) + (g << 8) + b;

	// Common colors - add your own!
	const colorPresets = {
		white: 0xffffff,
		gray: 0x7f7f7f,
		black: 0,
		red: 0xff0000,
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

	this.rainbow = [
		this.hex(0xff0000), this.hex(0xffff00), this.hex(0x00ff00),
		this.hex(0x00ffff), this.hex(0x0000ff), this.hex(0xff00ff)
	];

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
	this.hexDebugString = color => {
		if (!color) return '[none]';
		const hex = color & 0xffffff;
		const hexString = hex.toString(16);
		const opacity = (color >> 24).toString();
		return `#${'0'.repeat(6 - hexString.length)}${hexString} ${opacity}%`;
	};

	// Generates an array of [count] length of color codes linearly interpolated from [color1] to [color2]
	// [inclusive = false] is for chaining linear gradients, preventing the stop of a grad and start of the next from being duplicated
	this.linearGradient = function(color1, color2, count, inclusive = true) {
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
	this.linearGradientMulti = function(colorArray, segmentLength, inclusive = true) {
		const colorCount = colorArray.length;
		const outputLength = segmentLength * (colorCount - 1) + inclusive;
		const output = new Uint32Array(outputLength);

		let i = 0; let j = 0;
		do { // chain gradients
			const color1 = colorArray.at(i);
			const color2 = colorArray.at(i + 1);

			const grad = this.linearGradient(color1, color2, segmentLength, false);
			for (const color of grad) {
				output[j] = color;
				j++;
			}
			i++;
		} while (i < colorCount - 1);

		if (inclusive) output[outputLength - 1] = colorArray.at(-1);

		return output;
	}

	// POSITIONING TOOLS
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
