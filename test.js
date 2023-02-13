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
	buffer.write(' ello', hex(0xfe0000, 50), hex(0x3456ee, 40));
	// buffer.write('hello', 0, 0);
	buffer.render();

	await wait(1000);
	const second = manager.createBuffer(x, y, 5, 1, 1);
	second.write('blehh', hex(0x3470aa, 80), hex(0x444444, 100));
	second.render();

	await wait(1000);
	const third = manager.createBuffer(x, y, 5, 1, 3);
	third.write('     ', hex(0xeeeeee, 50), hex(0x11aa78, 60));
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
