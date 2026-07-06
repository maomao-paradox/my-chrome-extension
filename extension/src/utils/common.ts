/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/utils/common.ts
 * @date 2026-02-05T02:38:01.698Z
 */

import { storage } from '@/stores'
import type { DEBUGER } from '@/types';
import WasmFileMapDecryptor from './wasmFileMapDecryptor';


//@ts-ignore
const FILE_MAP_KEY = import.meta.env.VITE_FILE_MAP_KEY || 'mria_extension_default_key_32bytes_1234567890abcdef';
const decryptor = new WasmFileMapDecryptor(FILE_MAP_KEY);

interface DebuggerOptions {
	title?: string;
	mode: boolean;
	console?: Console;
}

const PREFIXED_CONSOLE_METHODS = new Set<PropertyKey>(['debug', 'error', 'info', 'log', 'trace', 'warn']);

const withDebugPrefix = (title: string, prop: PropertyKey, args: any[]): any[] => {
	if (!PREFIXED_CONSOLE_METHODS.has(prop)) {
		return args;
	}

	if (args.length === 0) {
		return [`[${title}]`];
	}

	const [firstArg, ...restArgs] = args;
	if (typeof firstArg === 'string') {
		return [`[${title}] ${firstArg}`, ...restArgs];
	}

	return [`[${title}]`, firstArg, ...restArgs];
};

const createDebugConsole = (baseConsole: Console, options: DebuggerOptions): Console & DEBUGER => {
	const state = {
		title: options.title || 'DEBUG',
		mode: options.mode,
	};
	let debugConsole: Console & DEBUGER;

	debugConsole = new Proxy(baseConsole, {
		get: (target, prop, receiver) => {
			if (prop === 'title' || prop === 'mode') {
				return state[prop];
			}

			const consoleValue = Reflect.get(target, prop, receiver);
			if (typeof consoleValue !== 'function') {
				return consoleValue;
			}

			if (!state.mode) {
				return () => debugConsole;
			}

			return (...args: any[]) => {
				Reflect.apply(consoleValue, target, withDebugPrefix(state.title, prop, args));
				return debugConsole;
			};
		},
		set: (target, prop, value, receiver) => {
			if (prop === 'title' && typeof value === 'string') {
				state.title = value;
				return true;
			}

			if (prop === 'mode' && typeof value === 'boolean') {
				state.mode = value;
				return true;
			}

			return Reflect.set(target, prop, value, receiver);
		}
	}) as Console & DEBUGER;

	return debugConsole;
};

export class Debug implements DEBUGER {
	title: string;
	mode: boolean;

	constructor(options: DebuggerOptions) {
		this.title = options.title || 'DEBUG';
		this.mode = options.mode;
		return createDebugConsole(options.console || console, options) as unknown as Debug;
	}
}

const domainCache = new Map<string, [string, string][]>();
const regexCache = new Map<string, RegExp>();

export const parseDomains = (domainsString: string): [string, string][] => {
	if (!domainsString) return [];
	if (domainCache.has(domainsString)) return domainCache.get(domainsString)!;
	const domains = domainsString.split(',').map(domain => {
		const parts = domain.trim().split(':');
		return parts.length === 1 ? [...parts, '*'] : parts;
	}) as [string, string][];
	domainCache.set(domainsString, domains);
	return domains;
};

export const equalDomain = (domain: [string, string], hostname: string, port: string): boolean =>
	(domain[0] === hostname || domain[0] === '*') && (domain[1] === port || domain[1] === '*');


export const getAssetsPath = (path: string) => {
	if (path.startsWith('patch-')) {
		return `assets/js/patch/${path}`;
	} else if (path.endsWith('.css')) {
		if (!path.startsWith('css/')) {
			return `css/${path}`;
		}
		return path;
	}
	return `assets/${path}`;
};

interface FileMap {
	[key: string]: string;
}

const fetchFileMapJson = async (): Promise<FileMap> => {
	return await decryptor.decryptAndLoad(chrome.runtime.getURL('file-map.json'));
};

interface FileMapLoader {
	(): FileMap | Promise<FileMap>;
	clear(): void;
}

export function loadFileMap(): FileMapLoader {
	let fileMap: FileMap | null = null;
	let fileMapPromise: Promise<FileMap> | null = null;

	const loader = function (): FileMap | Promise<FileMap> {
		if (fileMap) return fileMap;
		if (fileMapPromise) return fileMapPromise;

		fileMapPromise = fetchFileMapJson()
			.then(map => { fileMap = map; return map; })
			.catch(err => { maLogger.error('加载文件映射表失败:', err); throw err; })
			.finally(() => { fileMapPromise = null; });

		return fileMapPromise;
	};
	loader.clear = () => { fileMap = null; fileMapPromise = null; };
	return loader;
}

export const getChunkFileMap = loadFileMap();

export const getAssetsAbstractPath = async (path: string) => {
	try {
		const map = await getChunkFileMap();
		if (map && map[path]) {
			return chrome.runtime.getURL(map[path]);
		}

		return chrome.runtime.getURL(getAssetsPath(path));
	} catch (error) {
		maLogger.error('获取资产路径失败:', error);
		return '';
	}
};

export const getAssetsAbstractPathSync = (path: string) => {
	try {
		const map = getChunkFileMap() as FileMap;
		if (map && map[path]) {
			return chrome.runtime.getURL(map[path]);
		}

		return chrome.runtime.getURL(getAssetsPath(path));
	} catch (error) {
		maLogger.error('获取资产路径失败:', error);
		return '';
	}
};

export const getRuntimeScript = (scriptName: string) => {
	const scriptPath = 'js/runtime/' + scriptName
	return getAssetsAbstractPathSync(scriptPath);
};

export const getStaticAbstractPath = (path: string) => {
	return chrome.runtime.getURL(`static/${path}`);
};

