const stdout = process.stdout;
const rows = stdout.rows;
const columns = stdout.columns;

stdout.write('\x1b[2J'); // clear screen
stdout.write('\x1b[?25l'); // hide cursor
const wait = async miliseconds => new Promise(resolve => setTimeout(resolve, miliseconds));
const BufferManager = require('./manager.js');
const manager = new BufferManager();
const hex = manager.hex;

async function test1() {
	const x = 10;
	const y = 2;
	const buffer = manager.createBuffer(x, y, 5, 1);
	manager.setFg(hex(0xfe0000));
	manager.setBg(hex(0x222222));
	buffer.write('hello');
	buffer.render();

	await wait(1000);
	const second = manager.createBuffer(x, y, 5, 1);

	await wait(1000);
	stdout.cursorTo(0, rows - 2);
	stdout.write('\x1b[?25h\x1b[0m'); // show cursor
	process.exit();
}

test1();
