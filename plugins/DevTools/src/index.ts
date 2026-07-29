import { registerCommand } from "@vendetta/commands";
import { findByProps, findAll } from "@vendetta/metro";
import { clipboard } from "@vendetta/metro/common";
import { logger } from "@vendetta";

const MessageActions = findByProps("receiveMessage", "sendClydeError") ?? findByProps("receiveMessage");
const ChannelStore = findByProps("getLastSelectedChannelId");
const BotMessageCreator = findByProps("createBotMessage");
const BotAvatars = findByProps("BOT_AVATARS");

function sendLocalMessage(channelId: string, content: string) {
	const cId = channelId ?? ChannelStore?.getChannelId?.() ?? ChannelStore?.getLastSelectedChannelId?.();
	if (!BotMessageCreator || !MessageActions || !cId) return;

	// Automatically split giant outputs into multiple Discord messages
	const chunks = content.match(/[\s\S]{1,1900}/g) || [];
	
	for (const chunk of chunks) {
		const msg = BotMessageCreator.createBotMessage({ channelId: cId, content: chunk });
		
		msg.author.username = "DevTools";
		msg.author.avatar = "DevTools";
		if (BotAvatars && BotAvatars.BOT_AVATARS) {
			BotAvatars.BOT_AVATARS.DevTools = "https://cdn.discordapp.com/embed/avatars/0.png";
		}

		MessageActions.receiveMessage(cId, msg);
	}
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
						{ name: "getMaxFileSize", displayName: "getMaxFileSize", value: "getMaxFileSize" },
						{ name: "MAX_ATTACHMENT_SIZE", displayName: "MAX_ATTACHMENT_SIZE", value: "MAX_ATTACHMENT_SIZE" },
						{ name: "getUploadFileSizeLimit", displayName: "getUploadFileSizeLimit", value: "getUploadFileSizeLimit" },
						{ name: "UPLOAD_ATTACHMENT_MAX_SIZE", displayName: "UPLOAD_ATTACHMENT_MAX_SIZE", value: "UPLOAD_ATTACHMENT_MAX_SIZE" },
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
					name: "to_clipboard",
					displayName: "to_clipboard",
					description: "Copy results to clipboard instead of spamming chat?",
					displayDescription: "Copy results to clipboard?",
					required: false,
					type: 5, // BOOLEAN (Mobile Discord usually handles this fine as a toggle, or we can use type 3. Let's use type 3 to be safe based on past complaints)
					choices: [
						{ name: "true", displayName: "true", value: "true" },
						{ name: "false", displayName: "false", value: "false" }
					]
				}
			],
			applicationId: "-1",
			inputType: 1,
			type: 1,
			execute: (args: any, ctx: any) => {
				const query = args.find((a: any) => a.name === "query")?.value;
				const mode = args.find((a: any) => a.name === "mode")?.value || "fuzzy";
				const toClipboard = args.find((a: any) => a.name === "to_clipboard")?.value === "true";
				
				if (mode !== "dump_all" && !query) {
					sendLocalMessage(ctx.channel?.id, `❌ You must provide a \`query\` unless you are using \`mode: dump_all\`.`);
					return;
				}
				
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
						sendLocalMessage(ctx.channel?.id, `❌ No modules found matching your query.`);
						return;
					}

					let resultText = `✅ Found ${results.length} modules (Mode: ${mode}${query ? `, Query: ${query}` : ''}):\n\n`;
					
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

					if (toClipboard) {
						if (clipboard && clipboard.setString) {
							clipboard.setString(resultText);
							sendLocalMessage(ctx.channel?.id, `✅ Copied **${results.length}** modules to your clipboard securely!`);
						} else {
							sendLocalMessage(ctx.channel?.id, `❌ Clipboard API is not available on your client!`);
						}
					} else {
						sendLocalMessage(ctx.channel?.id, resultText);
					}
				} catch (e: any) {
					sendLocalMessage(ctx.channel?.id, `❌ Error searching props:\n\`\`\`js\n${e.message}\n\`\`\``);
				}
			}
		});

		unpatches.push(cmdDebug);
	},
	onUnload() {
		for (const unpatch of unpatches) unpatch();
		unpatches.length = 0;
	}
};
