import type { PluginStorage } from "./settings";

/**
 * Upload a file to the configured self-hosted file server.
 *
 * Uses raw XMLHttpRequest for upload-progress support (React Native's
 * `fetch` does not expose `upload.onprogress`).
 *
 * Returns the public URL of the uploaded file.
 */
export async function uploadToFileHost(
	file: { uri: string; name: string; type: string },
	storage: PluginStorage,
	onProgress?: (percent: number) => void,
): Promise<string> {
	const formData = new FormData();

	formData.append("file", {
		uri: file.uri,
		name: file.name,
		type: file.type || "application/octet-stream",
	} as any);

	let serverUrl = storage.serverUrl || "https://megumin.me/grimoire";
	if (serverUrl.endsWith("/")) serverUrl = serverUrl.slice(0, -1);
	
	const targetUrl = `${serverUrl}/upload`;

	try {
		// We use fetch since RN's XMLHttpRequest can sometimes instantly drop FormData uploads
		// Note: React Native's fetch doesn't support upload progress callbacks easily, 
		// so we just simulate a starting progress event.
		if (onProgress) onProgress(25);
		
		const response = await fetch(targetUrl, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${storage.apiToken}`,
			},
			body: formData,
		});

		const text = await response.text();

		if (!response.ok) {
			throw new Error(`Status ${response.status}: ${text}`);
		}

		try {
			const data = JSON.parse(text);
			if (data.url) return data.url;
			throw new Error("Server did not return a file URL");
		} catch (parseError) {
			throw new Error(`Invalid JSON response: ${text}`);
		}
	} catch (err: any) {
		throw new Error(err.message || "Network error during upload");
	}
}
