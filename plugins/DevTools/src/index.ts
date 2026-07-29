import { registerCommand } from "@vendetta/commands";
import { findByProps, findAll } from "@vendetta/metro";
import { clipboard } from "@vendetta/metro/common";

const MessageActions = findByProps("receiveMessage", "sendClydeError") ?? findByProps("receiveMessage");
const ChannelStore = findByProps("getLastSelectedChannelId");
const BotMessageCreator = findByProps("createBotMessage");
const BotAvatars = findByProps("BOT_AVATARS");

function getChannelId(ctxChannelId: string) {
	return ctxChannelId ?? ChannelStore?.getChannelId?.() ?? ChannelStore?.getLastSelectedChannelId?.();
}

function createLocalMessage(cId: string, content: string) {
	if (!BotMessageCreator || !MessageActions || !cId) return null;
	return BotMessageCreator.createBotMessage({ channelId: cId, content });
}

const unpatches: (() => void)[] = [];

export default {
	onLoad() {
		const cmdDebug = registerCommand({
			name: "debug",
			displayName: "debug",
			description: "The ultimate module debugger. Fuzzy search, exact match, or dump all modules.",
			displayDescription: "The ultimate module debugger",
			options: [
				{
					name: "query",
					displayName: "query",
					description: "What to search for (choose preset or type custom)",
					displayDescription: "What to search for",
					required: false,
					type: 3, // STRING
					choices: [
						{ name: "ThemeStore", displayName: "ThemeStore", value: "ThemeStore" },
						{ name: "ChannelStore", displayName: "ChannelStore", value: "ChannelStore" },
						{ name: "sendMessage", displayName: "sendMessage", value: "sendMessage" },
						{ name: "DCDFileManager", displayName: "DCDFileManager", value: "DCDFileManager" },
						{ name: "CloudUpload", displayName: "CloudUpload", value: "CloudUpload" }
					]
				},
				{
					name: "mode",
					displayName: "mode",
					description: "How to search (fuzzy, exact, or dump_all)",
					displayDescription: "How to search",
					required: false,
					type: 3, // STRING
					choices: [
						{ name: "fuzzy", displayName: "fuzzy (Contains substring)", value: "fuzzy" },
						{ name: "exact", displayName: "exact (Exact property match)", value: "exact" },
						{ name: "dump_all", displayName: "dump_all (Dump every module)", value: "dump_all" }
					]
				},
				{
					name: "output",
					displayName: "output",
					description: "Where to send the output",
					displayDescription: "Where to send the output",
					required: false,
					type: 3, // STRING
					choices: [
						{ name: "share", displayName: "share (Open OS Share menu to save/export)", value: "share" },
						{ name: "chat", displayName: "chat (Chunked chat messages)", value: "chat" }
					]
				}
			],
			applicationId: "-1",
			inputType: 1,
			type: 1,
			execute: (args: any, ctx: any) => {
				const query = args.find((a: any) => a.name === "query")?.value;
				const mode = args.find((a: any) => a.name === "mode")?.value || "fuzzy";
				const output = args.find((a: any) => a.name === "output")?.value || "share";
				const cId = getChannelId(ctx.channel?.id);
				
				if (!cId) return;

				if (mode !== "dump_all" && !query) {
					const err = createLocalMessage(cId, `❌ You must provide a \`query\` unless you are using \`mode: dump_all\`.`);
					if (err) MessageActions.receiveMessage(cId, err);
					return;
				}

				// Create dynamic status message
				const statusMsg = createLocalMessage(cId, `⏳ Starting debug process, this may take a moment...`);
				if (!statusMsg) return;
				MessageActions.receiveMessage(cId, statusMsg);

				// Defer heavy work so UI can render the status message
				setTimeout(() => {
					try {
						let results: any[] = [];
						
						if (mode === "dump_all") {
							results = findAll((m: any) => m && Object.keys(m).length > 0);
						} else if (mode === "exact") {
							const props = query.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
							const found = findByProps(...props);
							if (found) results = [found];
						} else {
							// fuzzy
							const q = query.toLowerCase();
							results = findAll((m: any) => m && Object.keys(m).some(k => k.toLowerCase().includes(q)));
						}
						
						if (!results || results.length === 0) {
							statusMsg.content = `❌ No modules found matching your query.`;
							MessageActions.receiveMessage(cId, statusMsg);
							return;
						}

						let resultText = "";
						if (mode === "dump_all") {
							// Ultra compact
							resultText = JSON.stringify(results.map(m => Object.keys(m)));
						} else {
							resultText = `✅ Found ${results.length} modules (Mode: ${mode}${query ? `, Query: ${query}` : ''}):\n\n`;
							for (let i = 0; i < results.length; i++) {
								const mod = results[i];
								const keys = Object.keys(mod);
								resultText += `**Match ${i + 1}** (Total keys: ${keys.length})\n`;
								if (mode === "fuzzy") {
									const q = query.toLowerCase();
									const matchingKeys = keys.filter(k => k.toLowerCase().includes(q));
									resultText += `Matching Keys: \`${matchingKeys.join(", ")}\`\n`;
								}
								resultText += `All Keys: \`${keys.join(", ")}\`\n\n`;
							}
						}

						if (output === "share") {
							if (resultText.length > 500000) {
								statusMsg.content = `⏳ Output is very large (${resultText.length} bytes). Uploading to paste.gg...`;
								MessageActions.receiveMessage(cId, statusMsg);

								fetch("https://api.paste.gg/v1/pastes", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										name: "DevTools Dump",
										files: [{ name: "dump.txt", content: { format: "text", value: resultText } }]
									})
								}).then(r => r.json()).then((json: any) => {
									if (json.status === "success") {
										const shareUrl = `https://paste.gg/p/anonymous/${json.result.id}`;
										const { Share } = findByProps("Share") || require("react-native");
										if (Share?.share) {
											statusMsg.content = `✅ Debug process done! Opening OS Share menu with paste URL...`;
											MessageActions.receiveMessage(cId, statusMsg);
											Share.share({ message: shareUrl }).catch((err: any) => {
												statusMsg.content = `❌ Share failed: ${err.message}\nURL: ${shareUrl}`;
												MessageActions.receiveMessage(cId, statusMsg);
											});
										} else {
											statusMsg.content = `✅ Uploaded to paste.gg: ${shareUrl}`;
											MessageActions.receiveMessage(cId, statusMsg);
										}
									} else {
										throw new Error(json.error || "Unknown paste.gg error");
									}
								}).catch((err: any) => {
									statusMsg.content = `❌ Upload failed: ${err.message}`;
									MessageActions.receiveMessage(cId, statusMsg);
								});
							} else {
								const { Share } = findByProps("Share") || require("react-native");
								if (Share?.share) {
									statusMsg.content = `✅ Debug process done! Opening OS Share menu...`;
									MessageActions.receiveMessage(cId, statusMsg);
									Share.share({ message: resultText, title: "DevTools Dump" }).catch((err: any) => {
										statusMsg.content = `❌ Share failed: ${err.message}`;
										MessageActions.receiveMessage(cId, statusMsg);
									});
								} else {
									statusMsg.content = `❌ Share API is not available on your client!`;
									MessageActions.receiveMessage(cId, statusMsg);
								}
							}
						} else {
							// Chat chunking
							statusMsg.content = `✅ Debug process done! Dumping to chat... (${results.length} modules found)`;
							MessageActions.receiveMessage(cId, statusMsg);
							
							const chunks = resultText.match(/[\s\S]{1,1900}/g) || [];
							for (const chunk of chunks) {
								const chunkMsg = createLocalMessage(cId, chunk);
								if (chunkMsg) MessageActions.receiveMessage(cId, chunkMsg);
							}
						}

					} catch (e: any) {
						statusMsg.content = `❌ Error searching props:\n\`\`\`js\n${e.message}\n\`\`\``;
						MessageActions.receiveMessage(cId, statusMsg);
					}
				}, 100);
			}
		});

		unpatches.push(cmdDebug);
	},
	onUnload() {
		for (const unpatch of unpatches) unpatch();
		unpatches.length = 0;
	}
};
