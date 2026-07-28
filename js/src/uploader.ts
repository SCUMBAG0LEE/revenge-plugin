import type { PluginStorage } from "./settings";

/**
 * Upload a file to the configured self-hosted file server.
 *
 * Uses raw XMLHttpRequest for upload-progress support (React Native's
 * `fetch` does not expose `upload.onprogress`).
 *
 * Returns the public URL of the uploaded file.
 */
export function uploadToFileHost(
	file: { uri: string; name: string; type: string },
	storage: PluginStorage,
	onProgress?: (percent: number) => void,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const formData = new FormData();

		// React Native expects a plain object for file blobs in FormData
		formData.append("file", {
			uri: file.uri,
			name: file.name,
			type: file.type || "application/octet-stream",
		} as any);

		const xhr = new XMLHttpRequest();

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable && onProgress) {
				onProgress(Math.round((event.loaded / event.total) * 100));
			}
		};

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const data = JSON.parse(xhr.responseText);
					if (data.url) {
						resolve(data.url);
					} else {
						reject(new Error("Server did not return a file URL"));
					}
				} catch {
					reject(new Error(`Invalid JSON response: ${xhr.responseText}`));
				}
			} else {
				reject(
					new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`),
				);
			}
		};

		xhr.onerror = () => reject(new Error("Network error during upload"));
		xhr.ontimeout = () => reject(new Error("Upload timed out"));

		const serverUrl = storage.serverUrl || "https://megumin.me/grimoire";
		xhr.open("POST", `${serverUrl}/upload`);
		xhr.setRequestHeader("Authorization", `Bearer ${storage.apiToken}`);
		xhr.send(formData);
	});
}
