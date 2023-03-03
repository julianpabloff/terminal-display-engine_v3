process.stdout.write('\x1b[0m\x1b[2J\x1b[3J'); // clear screen
process.stdout.write('\x1b[?25l'); // hide cursor
process.stdout.cursorTo(0,0);

const exit = () => {
	process.stdout.cursorTo(0, rows - 2);
	process.stdout.write('\x1b[?25h\x1b[0m'); // show cursor
	process.exit();
};

let rows = process.stdout.rows;
let columns = process.stdout.columns;
const centerWidth = width => Math.floor(columns / 2 - width / 2);
const centerHeight = height => Math.floor(rows / 2 - height / 2);

const BufferManager = require('../manager.js');
const BufferTools = require('../bufferTools.js');
const manager = new BufferManager();
const tools = new BufferTools(manager);
const hex = tools.hex;
const colors = tools.colors;

const width = 20;
const height = 4;

const buffer = manager.createBuffer(centerWidth(width), centerHeight(height), width, height, 1);
const second = manager.createBuffer(centerWidth(width * 2), centerHeight(height * 2), width * 2, height * 2);

function move() {
	buffer.move(centerWidth(width), centerHeight(height));
	second.move(centerWidth(width * 2), centerHeight(height * 2));
}
function draw() {
	second.fill(colors.black);
	manager.massRender();
}
draw();

const rainbow = [colors.red, colors.yellow, colors.green, colors.cyan, colors.blue, colors.magenta, colors.red];
const rainbowGrad = tools.linearGradientMulti(rainbow, 20, false);

let rainbowIndex = 0;
const rainbowLength = rainbowGrad.length;
function spectrumCycle() {
	const color = rainbowGrad[rainbowIndex];
	const negative = tools.getNegative(color);

	buffer.fill(color);
	manager.setFg(negative);
	const opacityString = `buffer opacity: ${buffer.opacity.toString()}%`;
	buffer.draw(opacityString, 0, 0);
	buffer.draw(tools.hexDebugString(color), 0, 1);
	buffer.render();

	manager.setFg(color);
	second.fill(negative);
	second.draw(tools.hexDebugString(negative), 1, 0);
	second.render();
	rainbowIndex = (rainbowIndex + 1) % rainbowLength;

	// manager.massRender();
}
setInterval(spectrumCycle, 40);

let opacity = 100;
function decreaseOpacity() {
	if (opacity > 0) opacity--;
	buffer.opacity = opacity;
}
function increaseOpacity() {
	if (opacity < 100) opacity++;
	buffer.opacity = opacity;
}

const keypress = require('keypress');
keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', (chunk, key) => {
	const keyPressed = key == undefined ? chunk : key.name;
	switch (keyPressed) {
		case 'p': manager.pauseRenders = !manager.pauseRenders; break;
		case 'o': buffer.opacity = 50; break;
		case 'c' : spectrumCycle(); break;
		case 'down': decreaseOpacity(); break;
		case 'up': increaseOpacity(); break;
		case 'c': spectrumCycle(); break;
		case 'q': exit();
	}
});

let resizeTimeout;
const resizeCooldown = 700;
process.stdout.on('resize', () => {
	rows = process.stdout.rows;
	columns = process.stdout.columns;
	manager.handleResize();
	manager.pauseRenders = true;
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(() => {
		move();
		manager.pauseRenders = false;
		// draw();
	}, resizeCooldown);
});
