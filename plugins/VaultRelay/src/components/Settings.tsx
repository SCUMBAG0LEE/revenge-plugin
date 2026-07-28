import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { Forms } from "@vendetta/ui/components";

const { FormSection, FormInput, FormSwitchRow } = Forms;
const { ScrollView } = ReactNative;

export default function Settings() {
	useProxy(storage);

	return (
		<ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 38 }}>
			<FormSection title="VaultRelay Settings" style={{ marginTop: 12 }}>
				<FormInput
					title="Server URL"
					placeholder="https://megumin.me/grimoire"
					value={storage.serverUrl ?? "https://megumin.me/grimoire"}
					onChange={(val: string) => {
						storage.serverUrl = val.replace(/\/+$/, "");
					}}
				/>

				<FormInput
					title="API Token"
					placeholder="Your secret bearer token"
					value={storage.apiToken ?? ""}
					onChange={(val: string) => {
						storage.apiToken = val;
					}}
					secureTextEntry
				/>

				<FormInput
					title="Max File Size (MB)"
					placeholder="<0 for Auto, 0 for Always"
					value={String(storage.maxFileSizeMB ?? -1)}
					onChange={(val: string) => {
						const n = Number.parseInt(val, 10);
						if (!Number.isNaN(n)) {
							storage.maxFileSizeMB = n;
						}
					}}
					keyboardType="numeric"
				/>

				<FormSwitchRow
					label="Auto Upload"
					subLabel="Automatically upload oversized files without prompting"
					value={storage.autoUpload ?? true}
					onValueChange={(val: boolean) => {
						storage.autoUpload = val;
					}}
				/>
			</FormSection>
		</ScrollView>
	);
}
