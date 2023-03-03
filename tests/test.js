const stdout = process.stdout;
const rows = stdout.rows;
const columns = stdout.columns;
const centerWidth = width => Math.floor(columns / 2 - width / 2);
const centerHeight = height => Math.floor(rows / 2 - height / 2);

stdout.write('\x1b[0m\x1b[2J\x1b[3J'); // clear screen
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

const BufferManager = require('../manager.js');
const BufferTools = require('../bufferTools.js');
const manager = new BufferManager();
const tools = new BufferTools(manager);
const hex = tools.hex;
const colors = tools.colors;
const color = tools.color;

async function test1() {
	const x = 10;
	const y = 2;
	const buffer = manager.createBuffer(x, y, 5, 1, 2);
	// buffer.write('hello', hex(0xfe0000, 0), hex(0x3456ee, 20));
	// buffer.write('hello', hex(0, 40), hex(0xaa33aa));
	buffer.fill(colors.yellow);
	buffer.render();

	await wait(1000);
	const second = manager.createBuffer(x, y, 5, 1, 1);
	second.write('hello', colors.white);
	second.render();
	// second.write('blehh', hex(0xb970aa, 0), hex(0x444444, 100));
	// second.render(false, true);

	// await wait(1000);
	// const third = manager.createBuffer(x, y, 5, 1, 3);
	// third.write('     ', hex(0xeeeeee, 40), hex(0x11aa78, 50));
	// third.render(false, true);

	// await wait(1000);
	// buffer.render(false, true);
	// await wait(1000);
	// buffer.write('aaaaa', hex(0xfe0000, 70), hex(0x3456ee, 10));
	// buffer.render(false, true);

	await wait(1000);
	exit();
}

// Real world test
async function test2() {

	const x = centerWidth(40);
	const y = centerHeight(8);
	const background = manager.createBuffer(5, y - 10, columns - 10, 28);
	background.fill(hex(0x333333)).render();

	await wait(500);
	const buffer = manager.createBuffer(x, y, 40, 8, 1);
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

	await wait(1000);
	buffer.draw('heh', buffer.end - 4, buffer.bottom - 1, hex(0xff0000, 70));
	buffer.paint();

	await wait(1000);
	exit();
}

// Debug replication of test2
async function test3() {
	const x = 10;
	const y = 2;

	const background = manager.createBuffer(x, y, 5, 1);
	background.fill(hex(0x666666, 40)).render(false, true);
	await wait(1000);
	const buffer = manager.createBuffer(x, y, 5, 1, 1);
	// buffer.write('hello', hex(0xfe0000, 0), hex(0x3456ee, 20));
	buffer.write('h', hex(0xcccccc), hex(0x4587bb));
	buffer.render(false, true);

	await wait(1000);
	const second = manager.createBuffer(x, y, 5, 1, 2);
	await intervalIterate(1, 51, i => {
		// second.fill(hex(0x45bb87, i * 2));
		// second.render(false, true);
	});

	// await wait(1000);
	// const second = manager.createBuffer(x, y, 5, 1, 2);
	// second.fill(hex(0x45bb87, 90));
	// second.render(false, true);

	await wait(1000);
	exit();
}

// Linear gradients
async function test4() {
	const buffer = manager.createBuffer(centerWidth(50), centerHeight(10), 50, 10);

	await wait(500);
	tools.outline(buffer, colors.blue, true);
	buffer.draw('hi', 1, 1);
	buffer.render();

	await wait(1000);
	const rainbow = [
		colors.red,
		colors.yellow,
		colors.green,
		colors.cyan,
		colors.blue,
		colors.magenta,
		colors.red
	];
	const rainbowGrad = tools.linearGradientMulti(rainbow, Math.floor((buffer.width - 2) / (rainbow.length - 1)), false);

	buffer.cursorTo(1, 2);
	for (const color of rainbowGrad) buffer.write(' ', 0, color);
	buffer.paint();

	await wait(1000);
	exit();
}

// Screen resize handling & buffer movement
async function test5() {
	const x = 10;
	const y = 0;
	const buffer = manager.createBuffer(x, y, 5, 1);
	const second = manager.createBuffer(x, y, 5, 1, 1);
	const third = manager.createBuffer(x, y, 5, 1, 2);

	third.write('yo', hex(0xaaffaa));
	buffer.fill(colors.red);
	buffer.render();

	await wait(1000);
	second.write('hi');
	second.render();
	
	await wait(1000);
	manager.clearScreen();

	await wait(1000);
	buffer.fill(hex(0x349923));
	second.draw('hi', 0, 0);
	manager.createScreenConstruction();

	await wait(1000);
	exit();
}

// redo of test1 but with the new manager requestdraw functions
async function test6() {
	const x = 10;
	const y = 2;
	const buffer = manager.createBuffer(x, y, 5, 1, 2);
	// buffer.write('hello', hex(0xfe0000, 0), hex(0x3456ee, 20));
	buffer.write('hello', hex(0, 40), hex(0xaa33aa));
	buffer.render();

	await wait(1000);
	const second = manager.createBuffer(x, y, 5, 1, 1);
	second.write('blehh', hex(0xb970aa, 0), hex(0x444444, 100));
	second.render();

	await wait(1000);
	const third = manager.createBuffer(x, y, 5, 1, 3);
	third.write('     ', hex(0xeeeeee, 40), hex(0x11aa78, 50));
	third.render();

	await wait(1000);
	buffer.render();

	await wait(1000);
	// second.write('     ', hex(0, 0), hex(0, 0));
	second.render();

	await wait(1000);
	exit();
}

// trying to break the mass render function
async function test7() {
	const x = 10;
	const y = 2;
	const buffer = manager.createBuffer(x, y, 20, 4);

	await wait(500);
	buffer.fill(hex(0x349934)).render();

	await wait(500);
	await intervalIterate(10, 100, i => {
		buffer.draw('hello', 0, 0, hex(0xfffff, i)).paint();
	});
	await wait(200);
	buffer.write(' bitch', colors.yellow).paint();

	await wait(500);
	const second = manager.createBuffer(x, y + buffer.height + 1, 20, 4);
	buffer.draw('hello', 0, 0);
	buffer.write(' bitch', colors.yellow);
	second.fill(hex(0x343499));
	// // manager.setBg(colors.red);
	second.draw('hi', 0, 0, colors.white);
	// process.stdout.write('x');
	// manager.createScreenConstruction();
	second.render();

	await wait(1000);
	exit();
}

// Using a new method for switching between buffers
async function test8() {
	const x = 10;
	const y = 2;
	const w = 20;
	const h = 4;
	const green = hex(0x349934);
	const blue = hex(0x343499);
	const buffer = manager.createBuffer(x, y, w, h);
	const second = manager.createBuffer(x, y + buffer.height - 1, w, h);
	const background = manager.createBuffer(x - 2, y - 1, w + 4, h * 2 - 1, 2);

	// buffer.persistent = true;
	// second.persistent = true;
	background.persistent = true;

	await wait(1000);
	background.fill(hex(0xffff00, 50));
	// background.fill(colors.yellow);
	background.render();

	await wait(1000);
	buffer.fill(green);
	buffer.write('hello');
	buffer.render();

	await wait(1000);
	second.fill(blue);
	second.write('bitch');
	manager.massRender();

	await wait(1000);
	await intervalIterate(10, 50, i => {
		background.fill(hex(0xffff00, 51 + i));
		background.render();
	});

	await wait(1000);
	exit();
}

// Resizing
async function test9() {
	const width = 20;
	const height = 4;
	const buffer = manager.createBuffer(centerWidth(width), centerHeight(height), width, height);
	buffer.fill(colors.red).render();
	// manager.massRender();

	let keepRunning = true;

	let resizeTimeout;
	const resizeWait = 1000;
	process.stdout.on('resize', () => {
		console.log('hehehe');
		/*
		manager.clearScreen();
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(() => {
			// Resize code goes here
			buffer.fill(colors.red);
			// after you draw everything you want, call manager.handleResize();
			// manager.handleResize();
			// quit after 2 seconds
			setTimeout(() => keepRunning = false, 2000);
		}, resizeWait);
		*/
	});

	// while (keepRunning) {
	// 	await wait(0);
	// }
	await wait(5000);
	exit();
}

// Simpler way to test resize
async function test10() {
	let width = 20;
	let height = 4;
	const buffer = manager.createBuffer(centerWidth(width), centerHeight(height), width, height, 1);
	width *= 2;
	height *= 2;
	const second = manager.createBuffer(centerWidth(width), centerHeight(height), width, height);

	await wait(500);
	buffer.fill(colors.red).render();
	second.fill(colors.magenta).render();

	await wait(1000);
	manager.clearScreen();

	await wait(1000);
	buffer.fill(colors.red);
	second.fill(colors.magenta);
	manager.massRender();
	// buffer.render();

	await wait(1000);
	exit();
}

// Moving buffers (buffer.move())
async function test11() {
	let width = 20;
	let height = 4;
	const x = centerWidth(width);
	const y = centerHeight(height);
	// const buffer = manager.createBuffer(0, 0, width, height);
	const buffer = manager.createBuffer(x, y, width, height);

	await wait(500);
	buffer.fill(colors.red).render();

	await wait(1000);
	// manager.handleResize();
	manager.clearScreen();
	// buffer.render();
	buffer.move(x - width - 5, y + height + 5);
	await wait(200);
	buffer.fill(colors.red).render();

	await wait(1000);
	exit();
}

// Buffer opacity
async function test12() {
	const buffer = manager.createBuffer(7, 3, 10, 4);
	const fadedRed = hex(0xff0000, 70);
	const fadeGrad = tools.linearGradient(fadedRed, colors.red, 10);
	const draw = () => {
		let i = 0;
		for (const color of fadeGrad) {
			for (let j = 0; j < 3; j++)
				buffer.draw(' ', i, j, 0, color);
			i++;
		}
		buffer.render();
	}
	draw();

	await wait(1000);
	buffer.opacity = 20;
	draw();

	await wait(1000);
	// buffer.draw('helloisdoisdoo', 4, 3, colors.red).paint();
	buffer.draw('helloisdoisdoo', 4, 3, hex(0xff0000, 20)).paint();

	await wait(1000);
	exit();
}

// Opacity foreground on nothing
async function test13() {
	const buffer = manager.createBuffer(17, 3, 10, 4);
	const fadedRed = hex(0xff0000, 70);
	buffer.fill(hex(0x343499));
	// buffer.wrap = true;
	buffer.draw('the violent bear it away', -19, 0);
	// buffer.cursorTo(0, 3);
	// buffer.write('the violent bear it away');
	buffer.render();

	await wait(1000);
	buffer.write('second thing');
	buffer.paint();

	await wait(1000);
	exit();
}

// test1();
// test2();
// test3();
// test4();
// test5();
// test6();
// test7();
// test8();
// test9(); // Resizing
// test10(); // Simpler way to test resize
// test11(); // Moving buffers (buffer.move())
// test12(); // Buffer opacity
test13(); // Opacity foreground on nothing
