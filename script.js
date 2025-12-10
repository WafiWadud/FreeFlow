(function () {
	let currentColor = null; // currently selected paint ID (line color)
	let previousPoint = null; // previous grid cell in the path
	let currentCell = null; // current cell being interacted with
	let paths = {}; // active paths for each color
	let isDrawing = false;
	let moveCount = 0;
	let gridSize = 0;

	// -------------------------------------------------------
	// Initialize grid from encoded patterns
	// -------------------------------------------------------
	function init() {
		let encodedPatterns = [
			"a1abc2bc",
			"2b7gfe5d10d1f3b1g2e1c2ca1h3a5h5",
			"4o1i9l6a11eb5g5e20j2g26n9f1f9l7h1o7n10j7c6pd3mc4h5p6im3kad23b2k1",
		];

		// Pick a random level
		let pattern =
			encodedPatterns[Math.floor(Math.random() * encodedPatterns.length)];
		buildGridFromPattern(pattern);

		let grid = document.querySelector(".grid");
		gridSize = parseInt(grid.getAttribute("data-size"));

		// Attach event listeners to each cell
		Array.from(grid.querySelectorAll("div")).forEach((cell, index) => {
			cell.setAttribute("data-i", index);

			if ("ontouchstart" in document) {
				cell.addEventListener("touchstart", startDraw, false);
				cell.addEventListener("touchmove", moveDraw, false);
				cell.addEventListener("touchend", endDraw, false);
			} else {
				cell.addEventListener("mousedown", startDraw, false);
				cell.addEventListener("mousemove", moveDraw, false);
				cell.addEventListener("mouseup", endDraw, false);
			}
		});
	}

	// -------------------------------------------------------
	// Decode pattern into grid cells
	// -------------------------------------------------------
	function buildGridFromPattern(str) {
		let cells = [];

		// Each pattern encodes runs of “0” cells and occasional letters meaning a point.
		while (str.length) {
			str = str.replace(/^\d+|[a-z]/i, function (match) {
				if (parseInt(match)) {
					let n = parseInt(match);
					while (n--) cells.push(0);
				} else {
					// letter → color ID (base-36 → number offset by 9)
					cells.push(parseInt(match, 36) - 9);
				}
				return "";
			});
		}

		let grid = document.querySelector(".grid");
		let size = Math.sqrt(cells.length);

		if (size !== parseInt(size)) {
			console.error("Invalid grid definition.");
			return;
		}

		grid.setAttribute("data-size", size);
		grid.innerHTML = "";

		cells.forEach((val) => {
			let div = document.createElement("div");
			if (val) {
				div.setAttribute("data-id", val);
				div.setAttribute("data-point", "true");
			}
			grid.appendChild(div);
		});
	}

	// -------------------------------------------------------
	// Determine direction between two cells: l/r/t/b
	// -------------------------------------------------------
	function getDirection(i1, i2) {
		let dx = (i1 % gridSize) - (i2 % gridSize);
		let dy = Math.floor(i1 / gridSize) - Math.floor(i2 / gridSize);

		if (dx === -1 && dy === 0) return "l";
		if (dx === 1 && dy === 0) return "r";
		if (dx === 0 && dy === -1) return "t";
		if (dx === 0 && dy === 1) return "b";
		return false;
	}

	// -------------------------------------------------------
	// Trim a path (used when user backtracks or overlaps)
	// -------------------------------------------------------
	function trimPath(path, keep) {
		if (!path.length) return [];

		let id = path[0].getAttribute("data-id");
		let grid = document.querySelector(".grid");

		// Clear "completed" markers
		grid.querySelectorAll(`div[data-id="${id}"]`).forEach((cell) => {
			cell.removeAttribute("data-completed");
		});

		keep = keep || 1;

		while (path.length > keep) {
			let tail = path.pop();
			let before = path[path.length - 1];
			let dir = getDirection(
				before.getAttribute("data-i"),
				tail.getAttribute("data-i"),
			);

			if (tail.getAttribute("data-point") !== "true") {
				tail.removeAttribute("data-id");
			}

			tail.removeAttribute(`data-${dir}`);
			before.removeAttribute(`data-${{ t: "b", b: "t", l: "r", r: "l" }[dir]}`);
		}

		if (path.length === 1) path.pop();

		return path;
	}

	// -------------------------------------------------------
	// Mouse/touch start
	// -------------------------------------------------------
	function startDraw(e) {
		let id = parseInt(this.getAttribute("data-id"));
		if (!id) return;

		// Only left-click for mouse
		if (e.type.startsWith("mouse") && e.which !== 1) return;

		if (currentColor !== id) moveCount++;

		previousPoint = currentColor;
		currentColor = id;

		if (currentCell !== e.target) {
			previousPoint = currentCell;
			currentCell = e.target;

			if (currentCell.getAttribute("data-point") === "true") {
				paths[id] = paths[id] ? trimPath(paths[id]) : [];
			} else {
				let idx = paths[id].indexOf(e.target);
				if (idx > -1) {
					paths[id] = trimPath(paths[id], idx + 1);
					previousPoint = paths[id][paths[id].length - 1];
				}
			}
			paths[id].push(currentCell);
		}

		isDrawing = true;
		e.preventDefault();
	}

	// -------------------------------------------------------
	// Mouse/touch move
	// -------------------------------------------------------
	function moveDraw(e) {
		if (!isDrawing) return;

		let target = e.target;

		if (e.type.startsWith("touch")) {
			let touch = e.touches[0];
			target = document.elementFromPoint(touch.pageX, touch.pageY);
		}

		if (!currentCell || target === currentCell) {
			e.preventDefault();
			return;
		}

		let dir = getDirection(
			currentCell.getAttribute("data-i"),
			target.getAttribute("data-i"),
		);
		if (!dir) return;

		let id = parseInt(target.getAttribute("data-id"));
		let isPoint = target.getAttribute("data-point") === "true";

		// If connecting to the matching endpoint
		if (id == currentColor) {
			let idx = paths[currentColor].indexOf(target);

			// backtracking
			if (idx > -1) {
				paths[currentColor] = trimPath(paths[currentColor], idx + 1);
				currentCell = paths[currentColor][paths[currentColor].length - 1];
				previousPoint = paths[currentColor][paths[currentColor].length - 2];
			}
			// reaching the end point
			else if (isPoint) {
				previousPoint = currentCell;
				currentCell = target;

				paths[currentColor].push(target);
				paths[currentColor].forEach((c) =>
					c.setAttribute("data-completed", "true"),
				);

				target.setAttribute("data-id", currentColor);
				target.setAttribute(`data-${dir}`, "");
				previousPoint.setAttribute(
					`data-${{ t: "b", b: "t", l: "r", r: "l" }[dir]}`,
					"",
				);
			}
		}
		// Empty cell: continue drawing
		else if (!id) {
			if (
				currentCell.getAttribute("data-point") &&
				paths[currentColor].length > 1
			)
				return;

			previousPoint = currentCell;
			currentCell = target;

			target.setAttribute("data-id", currentColor);
			target.setAttribute(`data-${dir}`, "");
			previousPoint.setAttribute(
				`data-${{ t: "b", b: "t", l: "r", r: "l" }[dir]}`,
				"",
			);

			paths[currentColor].push(target);
		}

		e.preventDefault();
	}

	// -------------------------------------------------------
	// Mouse/touch end
	// -------------------------------------------------------
	function endDraw(e) {
		if (isDrawing) {
			isDrawing = false;
			e.preventDefault();
		}
	}

	init();
})();
