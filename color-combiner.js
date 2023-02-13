const hexToRGB = hex => { return {r: hex >> 16, g: (hex >> 8) & 0xFF, b: hex & 0xFF} };
const rgbToHex = (r, g, b) => (r << 16) + (g << 8) + b;

const fgHexToString = hex => '\x1b[38;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
const bgHexToString = hex => '\x1b[48;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
const resetColorString = '\x1b[0m';

const hexDebugString = hex => {
	const ANSI = fgHexToString(hex);
	const hexString = hex.toString(16);
	return ANSI + '#' + '0'.repeat(6 - hexString.length) + hexString + resetColorString;
};

// This assumes the bottom color is 100 opacity
function layerColorsDebug(topColor, opacity, bottomColor) {
	const topRGB = hexToRGB(topColor);
	const bottomRGB = hexToRGB(bottomColor);

	console.log();
	console.log(`TOP COLOR:     ${hexDebugString(topColor)}  (${topRGB.r} ${topRGB.g} ${topRGB.b})`);
	console.log(`BOTTOM COLOR:  ${hexDebugString(bottomColor)}  (${bottomRGB.r} ${bottomRGB.g} ${bottomRGB.b})`);

	// Top color goes towards bottom color, so add this delta to the topColor
	const calcDelta = (top, bottom) => Math.floor((bottom - top) * (100 - opacity) / 100);
	const deltaR = calcDelta(topRGB.r, bottomRGB.r);
	const deltaG = calcDelta(topRGB.g, bottomRGB.g);
	const deltaB = calcDelta(topRGB.b, bottomRGB.b);

	console.log();
	console.log('deltaR', deltaR);
	console.log('deltaG', deltaG);
	console.log('deltaB', deltaB);

	const outputR = topRGB.r + deltaR;
	const outputG = topRGB.g + deltaG;
	const outputB = topRGB.b + deltaB;
	outputColor = rgbToHex(outputR, outputG, outputB);
	console.log();
	// console.log(outputR, outputG, outputB);
	// console.log(outputColor.toString(16));
	console.log(`OUTPUT COLOR:  ${hexDebugString(outputColor)}  (${outputR} ${outputG} ${outputB})`);
	console.log();
	console.log(fgHexToString(outputColor) + bgHexToString(bottomColor) + '    TEST    ' + resetColorString);
}

function layerColors(topColor, opacity, bottomColor) {
	const topRGB = hexToRGB(topColor);
	const bottomRGB = hexToRGB(bottomColor);
	const calcDelta = (top, bottom) => Math.floor((bottom - top) * (100 - opacity) / 100);
	const outputR = topRGB.r + calcDelta(topRGB.r, bottomRGB.r);
	const outputG = topRGB.g + calcDelta(topRGB.g, bottomRGB.g);
	const outputB = topRGB.b + calcDelta(topRGB.b, bottomRGB.b);
	outputColor = rgbToHex(outputR, outputG, outputB);
	console.log();
	console.log(fgHexToString(outputColor) + bgHexToString(bottomColor) + '    TEST    ' + resetColorString);
}

const color1 = 0x44eeff;
const color2 = 0x444444;

const intervalIterate = async (framestep, count, callback) => new Promise(resolve => {
	let i = 0;
	const interval = setInterval(() => {
		callback(i);
		i++;
		if (i >= count) {
			clearInterval(interval);
			resolve();
		}
	}, framestep);
});

process.stdout.write('\x1b[?25l'); // hide cursor
const frames = 30;
intervalIterate(10, frames, i => {
	const opacity = Math.floor(100 - 100 * i / (frames - 1));
	console.clear();
	layerColors(color1, opacity, color2);
}).then(() => {
	process.stdout.write('\x1b[?25h\x1b[0m'); // show cursor
});
