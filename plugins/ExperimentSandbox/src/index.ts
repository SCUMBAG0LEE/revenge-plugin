import { registerCommand } from "@vendetta/commands";
import { findByProps, findAll } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";

const ChannelStore = findByProps("getLastSelectedChannelId");
const MessageActions = findByProps("receiveMessage", "sendClydeError") ?? findByProps("receiveMessage");
const BotMessageCreator = findByProps("createBotMessage");

function sendLocal(cId: string, content: string) {
	if (!BotMessageCreator || !MessageActions || !cId) return;
	const msg = BotMessageCreator.createBotMessage({ channelId: cId, content });
	MessageActions.receiveMessage(cId, msg);
}

const unpatches: (() => void)[] = [];

export default {
	onLoad() {
		const cmdTest = registerCommand({
			name: "test",
			displayName: "test",
			description: "Run sandbox experiments.",
			displayDescription: "Run sandbox experiments.",
			options: [],
			applicationId: "-1",
			inputType: 1,
			type: 1,
			execute: async (args: any, ctx: any) => {
				const cId = ctx.channel?.id ?? ChannelStore?.getLastSelectedChannelId?.();
				sendLocal(cId, `🧪 Starting advanced sandbox tests...`);

				let report = "**🧪 Advanced Sandbox Report**\n\n";

				// Test 1: VaultRelay Upload -> Send Link -> Chat Input Injection
				try {
					const formData = new FormData();
					formData.append("file", "This is a dummy string payload representing a file");
					
					const r = await fetch("https://xeon.systems/discord/upload", { 
						method: "POST", 
						headers: { "Authorization": "Bearer temporarytestauthtoken" },
						body: formData 
					});
					
					const text = await r.text();
					if (r.status >= 500 || text.includes("<!DOCTYPE html>")) {
						report += `❌ \`vault_combo\` Hit 500 Error!\n**HTML Dump:**\n\`\`\`html\n${text.substring(0, 500)}\n\`\`\`\n`;
					} else if (r.ok) {
						const json = JSON.parse(text);
						report += `✅ \`vault_upload\`: Success! URL: ${json.url}\n`;
						
						// Test ComponentDispatch (Inject into Chat Box)
						try {
							const { ComponentDispatch } = findByProps("ComponentDispatch") || {};
							if (ComponentDispatch && ComponentDispatch.dispatchToLastSubscribed) {
								ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: `\n${json.url} ` });
								report += `✅ \`chat_input\`: Injected URL into chat box!\n`;
							} else {
								report += `❌ \`chat_input\`: ComponentDispatch not found.\n`;
							}
						} catch (e: any) {
							report += `❌ \`chat_input\` Crash: ${e.message}\n`;
						}

						// Test REST Message Sending
						const TokenStore = findByProps("getToken");
						const token = TokenStore?.getToken?.();
						if (token) {
							const restRes = await fetch(`https://discord.com/api/v9/channels/${cId}/messages`, {
								method: "POST",
								headers: { "Authorization": token, "Content-Type": "application/json" },
								body: JSON.stringify({
									content: `🧪 Sandbox Vault Combo Test! Uploaded file: ${json.url}`,
									nonce: Math.floor(Math.random() * 1000000000000000).toString()
								})
							});
							if (restRes.ok) report += `✅ \`real_msg\`: Sent via REST API!\n`;
							else report += `❌ \`real_msg\` REST failed: HTTP ${restRes.status}\n`;
						}
					} else {
						report += `❌ \`vault_combo\`: Status ${r.status}, response: ${text.substring(0, 100)}\n`;
					}
				} catch (e: any) {
					report += `❌ \`vault_combo\` Network Error: ${e.message}\n`;
				}

				// Test 3: 15MB Payload to Pastebins
				try {
					// Generate 15MB string
					const massiveString = "A".repeat(15 * 1024 * 1024);
					
					try {
						const r1 = await fetch("https://haste.zneix.eu/documents", { method: "POST", body: massiveString });
						if (r1.ok) {
							report += `✅ \`15MB haste.zneix.eu\`: Success\n`;
						} else {
							report += `❌ \`15MB haste.zneix.eu\`: Failed HTTP ${r1.status} - ${await r1.text()}\n`;
						}
					} catch (e: any) {
						report += `❌ \`15MB haste.zneix.eu\` Crash: ${e.message}\n`;
					}
					
					try {
						const r2 = await fetch("https://paste.nomsy.net/documents", { method: "POST", body: massiveString });
						if (r2.ok) {
							report += `✅ \`15MB paste.nomsy\`: Success\n`;
						} else {
							report += `❌ \`15MB paste.nomsy\`: Failed HTTP ${r2.status} - ${await r2.text()}\n`;
						}
					} catch (e: any) {
						report += `❌ \`15MB paste.nomsy\` Crash: ${e.message}\n`;
					}
				} catch (e: any) {
					report += `❌ \`15MB payload generator\` Failed: ${e.message}\n`;
				}

				// Send final report
				sendLocal(cId, report);
			}
		});
		unpatches.push(cmdTest);
	},
	onUnload() {
		for (const u of unpatches) u();
		unpatches.length = 0;
	}
};
