const BufferManager = require('../manager.js');
const BufferTools = require('../bufferTools.js');
const keypress = require('keypress');

const manager = new BufferManager();
const tools = new BufferTools(manager);
const hex = tools.hex;
const color = tools.color;
const colors = tools.colors;

manager.init();
const exit = () => {
	process.stdout.cursorTo(0, process.stdout.rows - 2);
	process.stdout.write('\x1b[?25h\x1b[0m'); // show cursor
	process.exit();
}

let handleKeypress = () => {};
let handleResize = () => {};

function test1() {
	const buffer = manager.createBuffer(0, 0, 10, 3);
	const fillRandom = () => buffer.fill(colors.random()).render();
	move(0, 0);

	function move(x, y) {
		buffer.move(x, y);
		const color = colors.random();
		buffer.fill(color);
		manager.setFg(tools.getNegative(color));
		buffer.draw('x: ' + x.toString(), 0, 0);
		buffer.draw('y: ' + y.toString(), 0, 1);
		buffer.render();
	}

	handleKeypress = key => {
		switch (key) {
			case 'c': fillRandom(); break;
			case 'left': move(buffer.x - 2, buffer.y); break;
			case 'right': move(buffer.x + 2, buffer.y); break;
			case 'up': move(buffer.x, buffer.y - 1); break;
			case 'down': move(buffer.x, buffer.y + 1); break;
		}
	}
}

test1();

keypress(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', (chunk, key) => {
	const keyPressed = key == undefined ? chunk : key.name;
	if (keyPressed == 'q') exit();
	handleKeypress(keyPressed);
});
