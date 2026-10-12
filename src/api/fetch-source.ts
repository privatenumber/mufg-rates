const userAgent = 'murc-rates (+https://www.npmjs.com/package/murc-rates)';
const requestTimeoutMilliseconds = 30_000;
const maxRetries = 2;

export const fetchSource = async (url: string): Promise<Response> => {
	let lastError: unknown;
	for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
		try {
			return await fetch(url, {
				headers: {
					'user-agent': userAgent,
				},
				redirect: 'manual',
				signal: AbortSignal.timeout(requestTimeoutMilliseconds),
			});
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error('Request failed after retries');
};

// Fetch Shift_JIS HTML page, return null on 301/302 (non-business day redirect).
// Throws on other non-2xx statuses (server errors should not be silently ignored).
export const fetchShiftJisHtml = async (url: string): Promise<string | null> => {
	const response = await fetchSource(url);
	if (response.status === 301 || response.status === 302) {
		return null;
	}

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`HTTP ${response.status}: ${url}`);
	}

	const buffer = await response.arrayBuffer();
	return new TextDecoder('shift_jis').decode(buffer);
};
