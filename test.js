const stdout = process.stdout;
const rows = stdout.rows;
const columns = stdout.columns;

stdout.write('\x1b[2J'); // clear screen
stdout.write('\x1b[?25l'); // hide cursor
process.stdout.cursorTo(0,0);
const wait = async miliseconds => new Promise(resolve => setTimeout(resolve, miliseconds));
const BufferManager = require('./manager.js');
const manager = new BufferManager();
const hex = manager.hex;

async function test1() {
	const x = 10;
	const y = 2;
	const buffer = manager.createBuffer(x, y, 5, 1, 2);
	//buffer.write('hello', hex(0xfe0000, 50), 0);
	buffer.write('hello', 0, 0);
	buffer.render();

	await wait(1000);
	const second = manager.createBuffer(x, y, 5, 1, 1);
	second.write('blehh', hex(0x3470aa), hex(0x444444));
	second.render();

	await wait(1000);
	const third = manager.createBuffer(x, y, 5, 1, 3);
	third.write('     ', hex(0x349912), hex(0x11ee78, 50));
	third.render();

	/*
	await wait(1000);
	third.write('world');
	third.render();
	 */

	await wait(1000);
	stdout.cursorTo(0, rows - 2);
	stdout.write('\x1b[?25h\x1b[0m'); // show cursor
	process.exit();
}

test1();
