export interface BackgroundPostJsonResult {
	payload: Record<string, any> | null;
	rawText: string;
	status: number;
}

export async function postJsonFromBackground(
	url: string,
	body: Record<string, any>
): Promise<BackgroundPostJsonResult> {
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	const rawText = await response.text();
	let payload: Record<string, any> | null = null;

	try {
		payload = rawText ? JSON.parse(rawText) : null;
	} catch {
		payload = null;
	}

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}${rawText ? `: ${rawText}` : ''}`);
	}

	if (payload && typeof payload.errcode === 'number' && payload.errcode !== 0) {
		throw new Error(payload.errmsg || `钉钉返回错误码 ${payload.errcode}`);
	}

	return {
		payload,
		rawText,
		status: response.status,
	};
}
