import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { Forms } from "@vendetta/ui/components";

const { FormSection, FormInput, FormSwitchRow, FormRow } = Forms;
const { ScrollView } = ReactNative;

export default function Settings() {
	useProxy(storage);

	return (
		<ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 38 }}>
			<FormSection title="VaultRelay Settings" style={{ marginTop: 12 }}>
				<FormInput
					title="Server URL"
					placeholder="https://xeon.systems/discord"
					value={storage.serverUrl ?? "https://xeon.systems/discord"}
					onChange={(val: string) => {
						storage.serverUrl = val.replace(/\/+$/, "");
					}}
				/>

				<FormInput
					title="API Token"
					placeholder="Your secret bearer token"
					value={storage.apiToken ?? "RevengeVaultRelay"}
					onChange={(val: string) => {
						storage.apiToken = val;
					}}
					secureTextEntry
				/>

				<FormInput
					title="Max File Size (MB)"
					placeholder="<0 for auto, 0 for always"
					value={String(storage.maxFileSizeMB ?? -1)}
					onChange={(val: string) => {
						const n = Number.parseInt(val, 10);
						if (!Number.isNaN(n)) {
							storage.maxFileSizeMB = n;
						}
					}}
					keyboardType="numeric"
				/>
				<FormRow 
					label=""
					subLabel="Set to < 0 to auto-detect Discord limits, 0 to always use VaultRelay, or e.g. 50 for Nitro."
				/>

				<FormSwitchRow
					label="Auto Upload"
					subLabel="Automatically upload oversized files without prompting"
					value={storage.autoUpload ?? true}
					onValueChange={(val: boolean) => {
						storage.autoUpload = val;
					}}
				/>

				<FormSwitchRow
					label="Auto Send Message"
					subLabel="Send the uploaded link automatically. If disabled, pastes the link into your chat box instead."
					value={storage.autoSend ?? true}
					onValueChange={(val: boolean) => {
						storage.autoSend = val;
					}}
				/>
			</FormSection>
		</ScrollView>
	);
}
