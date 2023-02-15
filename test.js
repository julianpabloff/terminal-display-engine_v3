const stdout = process.stdout;
const rows = stdout.rows;
const columns = stdout.columns;

stdout.write('\x1b[2J'); // clear screen
stdout.write('\x1b[?25l'); // hide cursor
process.stdout.cursorTo(0,0);

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

	const x = centerWidth(40);
	const y = centerHeight(8);
	// const background = manager.createBuffer(5, y - 10, columns - 20, 40 + 20);
	const background = manager.createBuffer(5, y - 10, columns - 10, 28);
	background.fill(hex(0x333333)).render();
	const buffer = manager.createBuffer(x, y, 40, 8, 1);

	// buffer.write('hello', hex(0xff0000), hex(0x444444)).render();
	// await wait(1000);
	// buffer.write('world', hex(0x00aa00)).render();

	buffer.fill(hex(0x4587bb));
	buffer.write('notice the color of this text changes', hex(0xcccccc), hex(0x4587bb));
	buffer.draw('when covered by a background', 0, 1, hex(0x666666), hex(0x4587bb));
	buffer.render();

	await wait(1000);
	const second = manager.createBuffer(x - 10, y - 4, 20, 8, 2);
	await intervalIterate(13, 71, i => {
		second.fill(hex(0x45bb87, i)); 
		second.render();
	});

	// await wait(1000);

	await wait(1000);
	exit();
}

async function test3() {
	const x = 10;
	const y = 2;

	const background = manager.createBuffer(x, y, 5, 1);
	background.fill(hex(0x666666, 40)).render(true);
	await wait(1000);
	const buffer = manager.createBuffer(x, y, 5, 1, 1);
	// buffer.write('hello', hex(0xfe0000, 0), hex(0x3456ee, 20));
	buffer.write('h', hex(0xcccccc), hex(0x4587bb));
	buffer.render(true);

	await wait(1000);
	const second = manager.createBuffer(x, y, 5, 1, 2);
	await intervalIterate(1, 51, i => {
		// second.fill(hex(0x45bb87, i * 2));
		// second.render(true);
	});

	// await wait(1000);
	// const second = manager.createBuffer(x, y, 5, 1, 2);
	// second.fill(hex(0x45bb87, 90));
	// second.render(true);

	await wait(1000);
	exit();
}

// test1();
test2();
// test3();
