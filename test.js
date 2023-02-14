const stdout = process.stdout;
const rows = stdout.rows;
const columns = stdout.columns;

stdout.write('\x1b[2J'); // clear screen
stdout.write('\x1b[?25l'); // hide cursor
process.stdout.cursorTo(0,0);

const exit = () => {
	stdout.cursorTo(0, rows - 2);
	stdout.write('\x1b[?25h\x1b[0m'); // show cursor
	process.exit();
};
const wait = async miliseconds => new Promise(resolve => setTimeout(resolve, miliseconds));
const BufferManager = require('./manager.js');
const manager = new BufferManager();
const hex = manager.hex;

async function test1() {
	const x = 10;
	const y = 2;
	const buffer = manager.createBuffer(x, y, 5, 1, 2);
	// buffer.write('hello', hex(0xfe0000, 0), hex(0x3456ee, 20));
	buffer.write('hello', hex(0, 40), hex(0xaa33aa));
	buffer.render(true);

	await wait(1000);
	const second = manager.createBuffer(x, y, 5, 1, 1);
	second.write('blehh', hex(0xb970aa, 0), hex(0x444444, 100));
	second.render(true);

	await wait(1000);
	const third = manager.createBuffer(x, y, 5, 1, 3);
	third.write('     ', hex(0xeeeeee, 40), hex(0x11aa78, 50));
	third.render(true);

	await wait(1000);
	buffer.write('aaaaa', hex(0xfe0000, 70), hex(0x3456ee, 0));
	buffer.render(true);

	await wait(1000);
	exit();
}

async function test2() {
	const centerWidth = width => Math.floor(columns / 2 - width / 2);
	const centerHeight = height => Math.floor(rows / 2 - height / 2);
	const buffer = manager.createBuffer(centerWidth(40), centerHeight(8), 40, 8);

	// buffer.write('hello', hex(0xff0000), hex(0x444444)).render();
	// await wait(1000);
	// buffer.write('world', hex(0x00aa00)).render();

	buffer.fill(hex(0x4587bb));
	buffer.write('notice the color of this text changes', hex(0xcccccc), hex(0x4587bb));
	buffer.draw('when covered by a background', 0, 1, hex(0x666666), hex(0x4587bb));
	buffer.render();

	await wait(1000);
	const second = manager.createBuffer(centerWidth(40) - 10, centerHeight(8) - 4, 20, 8);
	second.fill(hex(0x45bb87, 70));
	second.render();

	await wait(1000);
	exit();
}

async function test3() {
	const x = 10;
	const y = 2;

	const buffer = manager.createBuffer(x, y, 5, 1);
	// buffer.write('hello', hex(0xfe0000, 0), hex(0x3456ee, 20));
	buffer.write('h', hex(0x222222), hex(0x4587bb));
	buffer.render(true);

	// await wait(1000);
	// buffer.write('e', hex(0x222222), hex(0x4587bb));
	// buffer.render(true);

	await wait(1000);
	const second = manager.createBuffer(x, y, 5, 1, 1);
	second.fill(hex(0x45bb87, 90));
	second.render(true);

	await wait(1000);
	exit();
}

// test1();
test2();
// test3();
