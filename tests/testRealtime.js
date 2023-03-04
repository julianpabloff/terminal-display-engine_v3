const BufferManager = require('../manager.js');
const BufferTools = require('../bufferTools.js');
const keypress = require('keypress');

const manager = new BufferManager();
const tools = new BufferTools(manager);
const hex = tools.hex;
const color = tools.color;
const colors = tools.colors;
const negative = tools.getNegative;

manager.init();
const exit = () => {
	process.stdout.cursorTo(0, process.stdout.rows - 2);
	process.stdout.write('\x1b[?25h\x1b[0m'); // show cursor
	process.exit();
}

let handleKeypress = () => {};
let handleResize = () => {};

// Buffer move and drawAbsolute()
function test1() {
	const buffer = manager.createBuffer(0, 0, 20, 8);
	let background = colors.random();
	let foreground = colors.random();
	function moveBuffer(x, y) {
		buffer.move(x, y, false);
		background = colors.random();
	}

	let drawingX = tools.centerWidth(10);
	let drawingY = tools.centerHeight(4);
	function moveDrawing(x, y) {
		drawingX = x;
		drawingY = y;
		foreground = colors.random();
	}

	function draw() {
		buffer.fill(background);
		manager.setFg(foreground);
		for (let i = 0; i < 4; i++)
			buffer.drawAbsolute('0'.repeat(10), drawingX, drawingY + i);
		buffer.render();
	}

	moveBuffer(tools.centerWidth(20), tools.centerHeight(8));
	draw();

	handleKeypress = key => {
		switch (key) {
			case 'left':  moveBuffer(buffer.x - 2, buffer.y); draw(); break;
			case 'right': moveBuffer(buffer.x + 2, buffer.y); draw(); break;
			case 'up':    moveBuffer(buffer.x, buffer.y - 1); draw(); break;
			case 'down':  moveBuffer(buffer.x, buffer.y + 1); draw(); break;
			case 'w': moveDrawing(drawingX, drawingY - 1); draw(); break;
			case 'a': moveDrawing(drawingX - 2, drawingY); draw(); break;
			case 's': moveDrawing(drawingX, drawingY + 1); draw(); break;
			case 'd': moveDrawing(drawingX + 2, drawingY); draw(); break;
			case 'space':
				foreground = colors.random();
				background = colors.random();
				draw();
				break;
		}
	}
	handleResize = draw;
}

test1(); // Buffer move and drawAbsolute()

keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', (chunk, key) => {
	const keyPressed = key == undefined ? chunk : key.name;
	if (keyPressed == 'q') exit();
	handleKeypress(keyPressed);
});

keypress.enableMouse(process.stdout);
process.stdin.on('mousepress', info => {
	console.log(info);
});
process.on('exit', () => keypress.disableMouse(process.stdout));

let resizeTimeout;
const resizeCooldown = 700;
process.stdout.on('resize', () => {
	manager.handleResize();
	manager.pauseRenders = true;
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(() => {
		manager.pauseRenders = false;
		handleResize();
	}, resizeCooldown);
});
