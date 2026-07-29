import { registerCommand } from "@vendetta/commands";
import { findByProps, findAll } from "@vendetta/metro";
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
		const cmdProps = registerCommand({
			name: "debug-props",
			displayName: "debug-props",
			description: "Find module by exact properties and show result",
			displayDescription: "Find module by exact properties and show result",
			options: [
				{
					name: "props",
					displayName: "props",
					description: "Comma separated properties to find",
					displayDescription: "Comma separated properties to find",
					required: true,
					type: 3, // STRING
				}
			],
			applicationId: "-1",
			inputType: 1,
			type: 1,
			execute: (args: any, ctx: any) => {
				const propsStr = args.find((a: any) => a.name === "props")?.value;
				if (!propsStr) return;
				
				const props = propsStr.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
				
				let found: any = undefined;
				try {
					found = findByProps(...props);
				} catch (e: any) {
					sendLocalMessage(ctx.channel?.id, `❌ Error finding props:\n\`\`\`js\n${e.message}\n\`\`\``);
					return;
				}

				let resultText = `Results for \`findByProps("${props.join('", "')}")\`:\n`;
				if (!found) {
					resultText += "❌ Module not found (undefined).";
				} else {
					resultText += "✅ Found!\n";
					resultText += "Keys exported:\n```js\n";
					resultText += Object.keys(found).join(", ");
					resultText += "\n```";
				}

				sendLocalMessage(ctx.channel?.id, resultText);
			},
		});

		const cmdSearch = registerCommand({
			name: "search-props",
			displayName: "search-props",
			description: "Search all modules for a property name (fuzzy search)",
			displayDescription: "Search all modules for a property name",
			options: [
				{
					name: "query",
					displayName: "query",
					description: "A keyword to search for (e.g. 'Upload', 'Size')",
					displayDescription: "A keyword to search for (e.g. 'Upload', 'Size')",
					required: true,
					type: 3, // STRING
				},
				{
					name: "full",
					displayName: "full",
					description: "Show all keys instead of just a preview?",
					displayDescription: "Show all keys instead of just a preview?",
					required: false,
					type: 3, // STRING
					choices: [
						{ name: "true", displayName: "true", value: "true" },
						{ name: "false", displayName: "false", value: "false" }
					]
				},
				{
					name: "show_all_modules",
					displayName: "show_all_modules",
					description: "Show ALL matching modules (warning: can be huge)",
					displayDescription: "Show ALL matching modules",
					required: false,
					type: 3, // STRING
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
				const query = args.find((a: any) => a.name === "query")?.value?.toLowerCase();
				const full = args.find((a: any) => a.name === "full")?.value === "true";
				const showAll = args.find((a: any) => a.name === "show_all_modules")?.value === "true";
				if (!query) return;
				
				try {
					const results = findAll((m: any) => m && Object.keys(m).some(k => k.toLowerCase().includes(query)));
					
					if (!results || results.length === 0) {
						sendLocalMessage(ctx.channel?.id, `❌ No modules found with properties containing \`${query}\`.`);
						return;
					}

					let resultText = `✅ Found ${results.length} modules containing \`${query}\`:\n\n`;
					
					// Limit to 5 results to avoid giant text walls unless bypassed
					const toShow = showAll ? results : results.slice(0, 5);
					for (let i = 0; i < toShow.length; i++) {
						const mod = toShow[i];
						const keys = Object.keys(mod);
						const matchingKeys = keys.filter(k => k.toLowerCase().includes(query));
						resultText += `**Match ${i + 1}** (Total keys: ${keys.length})\n`;
						resultText += `Matching Keys: \`${matchingKeys.join(", ")}\`\n`;
						
						if (full) {
							resultText += `All Keys: \`${keys.join(", ")}\`\n\n`;
						} else {
							// Show a preview of the first few keys overall
							resultText += `Preview: \`${keys.slice(0, 5).join(", ")}${keys.length > 5 ? "..." : ""}\`\n\n`;
						}
					}

					if (results.length > 5 && !showAll) {
						resultText += `*...and ${results.length - 5} more modules not shown. Use \`show_all_modules: true\` to view all.*`;
					}

					sendLocalMessage(ctx.channel?.id, resultText);
				} catch (e: any) {
					sendLocalMessage(ctx.channel?.id, `❌ Error searching props:\n\`\`\`js\n${e.message}\n\`\`\``);
				}
			}
		});

		const cmdEval = registerCommand({
			name: "eval",
			displayName: "eval",
			description: "Evaluate arbitrary JS code",
			displayDescription: "Evaluate arbitrary JS code",
			options: [
				{
					name: "code",
					displayName: "code",
					description: "JS code to evaluate",
					displayDescription: "JS code to evaluate",
					required: true,
					type: 3, // STRING
				}
			],
			applicationId: "-1",
			inputType: 1,
			type: 1,
			execute: (args: any, ctx: any) => {
				const code = args.find((a: any) => a.name === "code")?.value;
				if (!code) return;
				
				try {
					const result = eval(code);
					const formatted = typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
					sendLocalMessage(ctx.channel?.id, `✅ **Eval Success**\n\`\`\`js\n${formatted}\n\`\`\``);
				} catch (e: any) {
					sendLocalMessage(ctx.channel?.id, `❌ **Eval Error**\n\`\`\`js\n${e.message}\n\`\`\``);
				}
			}
		});

		unpatches.push(cmdProps, cmdSearch, cmdEval);
	},
	onUnload() {
		for (const unpatch of unpatches) unpatch();
		unpatches.length = 0;
	}
};
