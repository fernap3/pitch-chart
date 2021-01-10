const pitchChart = document.getElementById("pitch-chart") as HTMLElement;
const pitchInput = document.getElementById("pitch-input") as HTMLInputElement;
const particlePitchInput = document.getElementById("particle-pitch") as HTMLSelectElement;
const downloadImageButton = document.getElementById("download-image") as HTMLButtonElement;
const copyImageButton = document.getElementById("copy-image") as HTMLButtonElement;
const backgroundStyleInput = document.getElementById("background-style") as HTMLSelectElement;
const backgroundColorInput = document.getElementById("background-color") as HTMLInputElement;
const pitchLookupInput = document.getElementById("pitch-lookup") as HTMLInputElement;
particlePitchInput.onchange = () => refreshSvg();
pitchInput.oninput = () => refreshSvg();
downloadImageButton.onclick = () => downloadImage();
copyImageButton.onclick = () => copyImageToClipboard();
backgroundStyleInput.onchange = () => backgroundColorInput.hidden = backgroundStyleInput.value === "transparent";
pitchLookupInput.oninput = () => onPitchSearchInput();

pitchInput.focus();

let pitchDictionary: {[word: string]: number[]} | null;
fetchPitchDictionary().then(dict => pitchDictionary = dict);

function refreshSvg()
{
	const pitchString = pitchInput.value.toUpperCase().split("").filter(c => c === "L" || c === "H").join("");
	pitchInput.value = pitchString;
	
	const svg = generateSvg(pitchString, particlePitchInput.value as "high" | "low");
	svg.style.height = "100px";
	pitchChart.innerHTML = "";
	pitchChart.appendChild(svg);
}

function generateSvg(inputString: string, particlePitch: "high" | "low")
{
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");

	const horizStepSize = 36;
	const anchorRadius = 5;
	const anchorStrokeWidth = 1;
	const anchorWidth = anchorRadius  + anchorStrokeWidth;
	const yLow = "75%";
	const yHigh = "15%";

	inputString += particlePitch === "low" ? "L" : "H";

	const svgWidth = anchorWidth*2 + horizStepSize * (inputString.length - 1);
	const svgHeight = 100;
	svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

	for (let i = 0; i < inputString.length; i++)
	{
		const currentChar = inputString.charAt(i);
		const nextChar = inputString.charAt(i+1);
		const y1 = currentChar === "L" ? yLow : yHigh;

		if (nextChar !== "")
		{
			const y2 = nextChar === "L" ? yLow : yHigh;
			const line = makeLine(anchorWidth + horizStepSize * i, anchorWidth + horizStepSize * (i+1), y1, y2);
			svg.appendChild(line);
		}

		const anchor = makeAnchor(anchorStrokeWidth, anchorRadius, anchorWidth + horizStepSize * i, y1, i === inputString.length - 1 ? "#ffffff" : undefined);
		svg.appendChild(anchor);
	}

	return svg;
}

function makeLine(x1: string | number, x2: string | number, y1: string | number, y2: string | number)
{
	const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
	line.setAttribute("stroke", "#0cd24d");
	line.setAttribute("stroke-width", "2");
	line.setAttribute("x1", x1 + "");
	line.setAttribute("y1", y1 + "");
	line.setAttribute("x2", x2 + "");
	line.setAttribute("y2", y2 + "");

	return line;
}

function makeAnchor(strokeWidth: number, radius: number, cx: string | number, cy: string | number, fill="#0cd24d")
{
	const anchor = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	anchor.setAttribute("fill", fill);
	anchor.setAttribute("stroke", "#000000");
	anchor.setAttribute("stroke-width", strokeWidth + "");
	anchor.setAttribute("r", radius + "");
	anchor.setAttribute("cx", cx + "");
	anchor.setAttribute("cy", cy + "");

	return anchor;
}

function makePng()
{
	const svg = document.querySelector("svg") as SVGElement;
	const canvas = document.createElement("canvas");
	const svgBounds = svg.getBoundingClientRect();
	canvas.width = svgBounds.width;
	canvas.height = svgBounds.height;
	const context = canvas.getContext("2d")!;

	if (backgroundStyleInput.value === "color")
	{
		if (!backgroundColorInput.value.startsWith("#"))
			throw new Error("Background color must be a hex string");
		
		context.fillStyle = backgroundColorInput.value;
		context.fillRect(0, 0, canvas.width, canvas.height);
	}

	const image = new Image();
	const svgData = (new XMLSerializer()).serializeToString(svg);
	const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
	const imageUrl = URL.createObjectURL(svgBlob);

	return new Promise<string>(resolve =>
	{
		image.onload = () => {
			context.drawImage(image, 0, 0);
			URL.revokeObjectURL(imageUrl);
			const imageUri = canvas.toDataURL();
			resolve(imageUri);
		};
		image.src = imageUrl;
	});
}

function triggerDownload(uri: string)
{
	const a = document.createElement("a");
	a.setAttribute("download", "pitch.png");
	a.setAttribute("href", uri);
	a.setAttribute("target", "_blank");
	a.click();
}

async function downloadImage()
{
	const uri = await makePng();
	triggerDownload(uri);
}

async function copyImageToClipboard()
{
	const uri = await makePng();
	const imageBlob = await fetch(uri).then(r => r.blob());

	await navigator.clipboard.write!([
		new ClipboardItem({
			[imageBlob.type]: imageBlob
		})
	]);
}

async function fetchPitchDictionary(): Promise<PitchDictionary>
{
	const response = await fetch("/pitch-table.json");

	if (!response.ok)
		throw new Error(`Error fetching pitch dictionary: ${response.status} ${await response.text()}`);

	return await response.json();
}

function onPitchSearchInput(): void
{
	const searchString = pitchLookupInput.value;
	if (!pitchDictionary || searchString.trim() === "")	
		return;

	const results = Object.entries(pitchDictionary).filter(e => e[0].includes(searchString));
	showSearchResults(results);
}

function pitchStringFromWord(word: string, pitchNum: number): string
{
	let pitchString = "";
	const wordPlusParticleLength = word.length + 1;
	
	for (let i = 0; i < wordPlusParticleLength; i++)
	{
		if ((pitchNum === 0 && i > 0) || (pitchNum === 1 && i === 0) || (i > 0 && i < pitchNum))
			pitchString += "H";
		else
			pitchString += "L";
	}

	return pitchString;
}

const searchResultsBox = document.createElement("ul");
searchResultsBox.id = "search-results";
searchResultsBox.hidden = true;
document.body.appendChild(searchResultsBox);

function showSearchResults(results: [string, number[]][]): void
{
	const searchBoxBounds = pitchLookupInput.getBoundingClientRect();
	searchResultsBox.style.top = searchBoxBounds.top + "px";
	searchResultsBox.style.left = searchBoxBounds.right + "px";
	
	searchResultsBox.innerHTML = "";

	for (const result of results)
	{
		const item = document.createElement("li");
		item.textContent = result[0];
		item.onclick = () => {
			displayPitch(pitchStringFromWord(result[0], result[1][0])); // TODO there can be multiple pitch alternatives
			hideSearchResults();
		};
		searchResultsBox.appendChild(item);
	}
	
	searchResultsBox.hidden = false;
}

function hideSearchResults(): void
{
	searchResultsBox.hidden = true;
}

function displayPitch(pitchString: string): void
{
	pitchInput.value = pitchString;
	refreshSvg();
}

type PitchDictionary = { [word: string]: number[] };
