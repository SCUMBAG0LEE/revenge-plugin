import { before, after } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { storage } from "@vendetta/plugin";
import { getAssetIDByName } from "@vendetta/ui/assets";

import { uploadToFileHost } from "./uploader";
import type { PluginStorage } from "./settings";

// Discord internal modules
const CloudUpload = findByProps("CloudUpload")?.CloudUpload;
const MessageSender = findByProps("sendMessage", "editMessage");
const ChannelStore = findByProps("getChannelId");
const UploadLimits = findByProps("getMaxFileSize");

const MB = 1024 * 1024;
export let realMaxFileSize = 10 * MB; // fallback to 10MB

export function patchUploadLimits(): (() => void) | undefined {
	const UploadLimits = findByProps("DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE");
	if (!UploadLimits) {
		console.warn("[VaultRelay] UploadLimits module not found — UI limit patching skipped");
		return undefined;
	}
	
	try {
		// Store the real value before we overwrite it
		const realLimit = UploadLimits.DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE;
		if (typeof realLimit === "number") {
			realMaxFileSize = realLimit;
		}

		// Metro modules are often frozen, so defineProperty might fail. 
		// We'll try basic assignment first, then defineProperty.
		try {
			UploadLimits.DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE = Number.MAX_SAFE_INTEGER;
		} catch {
			Object.defineProperty(UploadLimits, "DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE", {
				value: Number.MAX_SAFE_INTEGER,
				writable: true,
				configurable: true
			});
		}

		// Return an unpatch function that restores the original value
		return () => {
			try {
				UploadLimits.DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE = realLimit;
			} catch {
				Object.defineProperty(UploadLimits, "DEFAULT_MOBILE_PRE_COMPRESSION_MAX_ATTACHMENT_SIZE", {
					value: realLimit,
					writable: true,
					configurable: true
				});
			}
		};
	} catch (err) {
		console.error("[VaultRelay] Failed to patch UploadLimits:", err);
		return undefined;
	}
}

/**
 * Patches the CloudUpload constructor to intercept file uploads that
 * exceed the configured size threshold.
 *
 * When a file is too large for Discord, it is uploaded to the VaultRelay
 * server and the resulting public URL is prepended to the message body.
 */
export function patchUploader(): (() => void) | undefined {
	if (!CloudUpload) {
		console.warn("[VaultRelay] CloudUpload module not found — upload patching skipped");
		return undefined;
	}

	const originalUpload = CloudUpload.prototype.reactNativeCompressAndExtractData;
	if (!originalUpload) return undefined;

	CloudUpload.prototype.reactNativeCompressAndExtractData = async function (...args: any[]) {
		const file = this;
		// If size is missing or 0, assume it's large so we don't accidentally skip it
		let size = file?.preCompressionSize ?? file?.size ?? file?.currentSize;
		if (typeof size !== "number" || size === 0) size = Number.MAX_SAFE_INTEGER;
		
		const cfg = storage as unknown as PluginStorage;
		const manualSetting = cfg.maxFileSizeMB ?? -1;
		const maxBytes = manualSetting < 0 ? realMaxFileSize : (manualSetting * MB);

		showToast(`Debug VR: preComp=${this?.preCompressionSize}, size=${this?.size}, max=${maxBytes}`, getAssetIDByName("ic_info"));

		if (size <= maxBytes) return originalUpload.apply(this, args);

		if (!cfg.apiToken) {
			showToast("⚠️ VaultRelay: Missing API Token in settings! Uploading to Discord normally...", getAssetIDByName("ic_warning_24px"));
			return originalUpload.apply(this, args);
		}

		// Bypass Discord's file size limit check by spoofing the size
		this.preCompressionSize = 1337;

		showToast(
			`📤 Uploading ${file.filename ?? file.name ?? "file"} to VaultRelay...`,
			getAssetIDByName("ic_upload"),
		);

		try {
			const url = await uploadToFileHost(
				{
					uri: file.uri ?? file.path ?? file.url,
					name: file.filename ?? file.name ?? "file",
					type: file.mime ?? file.type ?? "application/octet-stream",
				},
				cfg,
				(pct) => {
					if (pct % 25 === 0) {
						showToast(
							`📤 Uploading... ${pct}%`,
							getAssetIDByName("ic_upload"),
						);
					}
				},
			);

			if (typeof this.setStatus === "function") this.setStatus("CANCELED");

			showToast(
				`✅ Uploaded to VaultRelay!`,
				getAssetIDByName("Check"),
			);

			const channelId = this.channelId ?? ChannelStore?.getChannelId?.();
			if (channelId && MessageSender) {
				MessageSender.sendMessage(channelId, { content: url });
			}
		} catch (err: any) {
			showToast(
				`❌ Upload failed: ${err.message}`,
				getAssetIDByName("Small"),
			);
			console.error("[VaultRelay] Upload error:", err);
			if (typeof this.setStatus === "function") this.setStatus("CANCELED");
		}

		return null;
	};

	return () => {
		CloudUpload.prototype.reactNativeCompressAndExtractData = originalUpload;
	};
}

/**
 * Patches the sendMessage function to intercept messages with oversized
 * attachments, upload them to VaultRelay, and replace the attachment with
 * the returned URL in the message content.
 */
export function patchMessageSender(): (() => void) | undefined {
	if (!MessageSender) {
		console.warn("[VaultRelay] MessageSender module not found — message patching skipped");
		return undefined;
	}

	try {
		return before("sendMessage", MessageSender, (args: any[]) => {
			const cfg = storage as unknown as PluginStorage;
			const manualSetting = cfg.maxFileSizeMB ?? -1;
			const maxBytes = manualSetting < 0 ? realMaxFileSize : (manualSetting * MB);
			const message = args[1];

			if (!cfg.apiToken || !message?.attachments?.length) return;

			const oversized = message.attachments.filter(
				(a: any) => a.size && a.size > maxBytes,
			);

			if (oversized.length === 0) return;

			// Keep only attachments under the limit
			message.attachments = message.attachments.filter(
				(a: any) => !a.size || a.size <= maxBytes,
			);

			const channelId = args[0];

			for (const file of oversized) {
				showToast(
					`📤 Uploading ${file.filename ?? "file"} to VaultRelay...`,
					getAssetIDByName("ic_upload"),
				);

				uploadToFileHost(
					{
						uri: file.uri ?? file.url,
						name: file.filename ?? "file",
						type: file.content_type ?? "application/octet-stream",
					},
					cfg,
				)
					.then((url) => {
						showToast(
							`✅ Uploaded to VaultRelay!`,
							getAssetIDByName("Check"),
						);
						if (MessageSender) {
							MessageSender.sendMessage(channelId, { content: url });
						}
					})
					.catch((err: Error) => {
						showToast(
							`❌ Upload failed: ${err.message}`,
							getAssetIDByName("Small"),
						);
						console.error("[VaultRelay] Upload error:", err);
					});
			}
		});
	} catch (err) {
		console.error("[VaultRelay] Failed to patch MessageSender:", err);
		return undefined;
	}
}
