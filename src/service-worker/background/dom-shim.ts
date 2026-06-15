/**
 * Some shared browser-side modules probe document/window even when bundled into
 * the MV3 service worker. This shim keeps those probes from crashing.
 */
const noop = () => undefined;

const mockDocument = {
	createElement: (tag: string) => {
		console.log('Mock document.createElement called for:', tag);
		return {
			tagName: tag.toUpperCase(),
			style: {},
			setAttribute: noop,
			appendChild: noop,
			removeChild: noop,
			addEventListener: noop,
			removeEventListener: noop,
			querySelector: () => null,
			querySelectorAll: () => [],
			documentElement: { style: {} },
			head: { appendChild: noop },
			body: { appendChild: noop }
		};
	},
	createTextNode: (text: string) => ({
		nodeType: 3,
		textContent: text,
		nodeValue: text
	}),
	createDocumentFragment: () => ({
		nodeType: 11,
		appendChild: noop
	}),
	defaultView: null,
	nodeType: 9,
	write: noop,
	writeln: noop,
	close: noop
};

type GlobalWithDomShim = typeof globalThis & {
	document?: typeof mockDocument;
	window?: GlobalWithDomShim;
};

const globalScope = globalThis as GlobalWithDomShim;

if (globalScope.document === undefined) {
	globalScope.document = mockDocument;
}

if (globalScope.window === undefined) {
	globalScope.window = globalScope;
}

if (globalScope.window.document === undefined) {
	globalScope.window.document = mockDocument;
}
