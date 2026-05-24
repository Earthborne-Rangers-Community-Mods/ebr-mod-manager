export interface Env {
	GITHUB_TOKEN: string;
	ALLOWED_ORIGIN: string;
}

// Only forward requests that match the GitHub zipball path shape.
// Pattern: /repos/{owner}/{repo}/zipball/{commitHash}
// Owner and repo are alphanumeric + hyphens. CommitHash is a 40-char hex SHA.
const ZIPBALL_PATH = /^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/zipball\/[0-9a-f]{40}$/;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Handle CORS preflight.
		if (request.method === 'OPTIONS') {
			return corsResponse(null, 204, env.ALLOWED_ORIGIN);
		}

		// Only GET is valid.
		if (request.method !== 'GET') {
			return corsResponse('Method not allowed', 405, env.ALLOWED_ORIGIN);
		}

		// Validate path shape before forwarding. Rejects anything outside the
		// expected pattern, including path traversal attempts.
		if (!ZIPBALL_PATH.test(url.pathname)) {
			return corsResponse('Not found', 404, env.ALLOWED_ORIGIN);
		}

		const githubUrl = `https://api.github.com${url.pathname}`;

		let upstream: Response;
		try {
			upstream = await fetch(githubUrl, {
				headers: {
					Accept: 'application/vnd.github+json',
					Authorization: `Bearer ${env.GITHUB_TOKEN}`,
					'User-Agent': 'ebr-mod-proxy/1.0',
					'X-GitHub-Api-Version': '2022-11-28',
				},
				// redirect: 'follow' is the default. GitHub returns a 302 to
				// codeload.github.com; Cloudflare follows it and the auth header
				// is not forwarded (correct - codeload uses a pre-signed URL).
				redirect: 'follow',
			});
		} catch (err) {
			return corsResponse('Upstream request failed', 502, env.ALLOWED_ORIGIN);
		}

		if (!upstream.ok) {
			return corsResponse(
				`GitHub API error: ${upstream.status} ${upstream.statusText}`,
				upstream.status,
				env.ALLOWED_ORIGIN,
			);
		}

		// Forward the zip body with CORS headers.
		const headers = new Headers({
			'Content-Type': upstream.headers.get('Content-Type') ?? 'application/zip',
			'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
			'Cache-Control': 'public, max-age=31536000, immutable',
		});
		const contentLength = upstream.headers.get('Content-Length');
		if (contentLength) {
			headers.set('Content-Length', contentLength);
		}

		return new Response(upstream.body, { status: 200, headers });
	},
};

function corsResponse(
	body: string | null,
	status: number,
	allowedOrigin: string,
): Response {
	const headers = new Headers({
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
	});
	return new Response(body, { status, headers });
}
