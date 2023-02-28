const BufferTools = function(manager) {
	this.hex = (hex, opacity = 100) => hex + (opacity << 24);
	this.rgba = (r, g, b, a = 100) => (a << 24) + (r << 16) + (g << 8) + b;

	// Common colors
	this.colors = {
		'white': this.hex(0xffffff),
		'gray': this.hex(0x7f7f7f),
		'red': this.hex(0xff0000),
		'yellow': this.hex(0xffff00),
		'green': this.hex(0x00ff00),
		'cyan': this.hex(0x00ffff),
		'blue': this.hex(0x0000ff),
		'magenta': this.hex(0xff00ff),
	};

	// Generates an array of [count] length of color codes linearly interpolated from [color1] to [color2]
	// [inclusive = false] is for chaining linear gradients, preventing the stop of a grad and start of the next from being duplicated
	//   - makes the color change rate longer, as if there was one extra count, but still cuts it off at the count
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
