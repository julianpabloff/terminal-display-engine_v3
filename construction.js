const Node = function(id, index, data) {
	this.id = id;
	this.index = index;
	this.data = data;
	this.next = null;
}
const Construction = function() {
	const addedIDs = new Set();
	let start = { next: null };
	this.length = 0;
	this.addSorted = function(id, index, data) {
		const newNode = new Node(id, index, data);
		let runner = start;
		while (runner.next) {
			// Replaces duplicate instead of adding to the sll
			if (id === runner.next.id) {
				const temp = runner.next.next;
				runner.next = newNode;
				runner.next.next = temp;
				return;
			}
			if (index < runner.next.index) {
				const temp = runner.next;
				runner.next = newNode;
				runner.next.next = temp;
				addedIDs.add(id);
				this.length++;
				
				let sprinter = runner.next.next;
				while (sprinter.next) {
					if (id === sprinter.next.id) {
						sprinter.next = sprinter.next.next;
						this.length--;
						return;
					}
					sprinter = sprinter.next;
				}
				return;
			}
			runner = runner.next;
		}
			runner.next = newNode;
		addedIDs.add(id);
		this.length++;
	}
	this.deleteById = function(id) {
		let runner = start;
		while (runner.next) {
			if (id == runner.next.id) {
				runner.next = runner.next.next;
				this.length--;
				addedIDs.delete(id);
				return;
			}
		}
	}
	this.findById = function(id) {
		let runner = start;
		while (runner.next) {
			if (id == runner.next.id) {
				return runner.next.data;
			}
			runner = runner.next;
		}
		return false;
	}
	this.has = function(id) {
		return addedIDs.has(id);
	}
	this.forEach = function(callback) {
		let runner = start;
		let index = 0;
		while (runner.next) {
			callback(runner.next.data);
			index++;
			runner = runner.next;
		}
	}

	this.determineOutput = function() {
		debug();
		let outputCode = 32;
		let outputFg = 0;
		let outputBg = 0;
		let fgStackIndex = null;
		let bgStack = [];
		let topHalfStack = [];
		let botHalfStack = [];
		let fgOpacityAConcern = false;
		let bgOpacityAConcern = false;
		let pixelOnTop = false;

		let stackIndex = 0;
		this.forEach(data => {
			if (data.type == 'point') {
				const code = data.code;
				const fg = data.fg;
				const bg = data.bg;
				const fgOpacity = getOpacity(fg);
				const bgOpacity = getOpacity(bg);

				if (bgOpacity) {
					if (bgOpacity == 100) {
						outputCode = 32;
						outputFg = 0;
						bgStack = [bg];
						topHalfStack = [bg];
						botHalfStack = [bg];
						stackIndex = 0;
						fgStackIndex = null;
						fgOpacityAConcern = bgOpacityAConcern = false;
					} else if (!bgOpacityAConcern) {
						if (!bgStack.length) bgStack.push(100 << 24);
						if (!topHalfStack.length) topHalfStack.push(100 << 24);
						if (!botHalfStack.length) botHalfStack.push(100 << 24);
						bgOpacityAConcern = true;
					}
					if (bgOpacityAConcern) {
						bgStack.push(bg);
						topHalfStack.push(bg);
						botHalfStack.push(bg);
						stackIndex++;
					}
				}
				if (code != 32 && fgOpacity) {
					fgStackIndex = stackIndex;
					fgOpacityAConcern = fgOpacity < 100;
					outputFg = fg;
					outputCode = code;
				}
			} else if (data.type == 'pixel') {
				const top = data.top;
				const bottom = data.bottom;
				const topOpacity = getOpacity(top);
				const botOpacity = getOpacity(bottom);
				if (topOpacity || botOpacity) {
					fgStackIndex = null;
					fgOpacityAConcern = false;
				}
				if (topOpacity) {
					topHalfStack.push(top);
				}
				if (botOpacity) {
					botHalfStack.push(bot);
				}
			}
		});

		const logStack = stack => {
			const stackLog = [];
			stack.forEach(color => stackLog.push(hexDebugString(color)));
			return stackLog;
		}
		console.log('fgStackIndex', fgStackIndex);
		console.log('topStack', ...logStack(topHalfStack));
		console.log('botStack', ...logStack(botHalfStack));
		console.log('bgStack', ...logStack(bgStack));
		console.log('fgOpacityAConcern', fgOpacityAConcern);
		console.log('bgOpacityAConcern', bgOpacityAConcern);
		console.log('OUTPUT: code', outputCode, 'fg', hexDebugString(outputFg), 'bg', hexDebugString(outputBg));
	}

	// IN THIS SCENARIO...

	// Just the top half of a pixel on top of a char
	//   -->  The char goes away, the top half of the pixel becomes the effective "foreground" color
	//        and the background color gets inherited from below in the bgStack

	// If a pixel is at all on top of a char
	//   -->  The char goes away. The pixel, both the top and the bottom, is effectively a char with
	//        a top and a bottom foreground color

	// A char is on top with pixels underneath, and underneath the top color output is different than the bottom
	//   -->  Default to the top half output color, and make that the background of the char
	//        then layer any clear (code = 32) background colors on top from there

	// Opacity < 100 pixel (top and bottom) on top of a non-space char with a background color
	//   --> The char goes away (outputCode = 32)
	//   --> The background color of the char gets added to the top and bottom stacks, and they both influence the
	//       output color of the pixel

	const getOpacity = code => code >> 24;
	const getHex = code => code & 0xffffff;
	const fgHexToString = hex => '\x1b[38;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const bgHexToString = hex => '\x1b[48;2;' + (hex >> 16).toString() + ';' + ((hex >> 8) & 0xFF).toString() + ';' + (hex & 0xFF).toString() + 'm';
	const resetString = '\x1b[0m';

	const hexDebugString = color => {
		if (!color) return resetString + '[none]' + resetString;
		const hex = getHex(color);
		const ANSI = fgHexToString(hex);
		const hexString = hex.toString(16);
		return ANSI + '#' + '0'.repeat(6 - hexString.length) + hexString + resetString;
	};
	const debug = function() {
		if (!this.length) {
			console.log('this construction is empty');
			return;
		}
		console.log('construction length', this.length);
		this.forEach(item => {
			for (const key of Object.keys(item)) {
				const logArray = ['   ', key];
				const value = item[key];
				if (key != 'code' && key != 'type') {
					logArray.push(hexDebugString(value), getOpacity(value));
				} else logArray.push(value);
				console.log(...logArray);
			}
			console.log();
		});
	}.bind(this);
}

module.exports = Construction;
