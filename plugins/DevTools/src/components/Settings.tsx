import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { storage } from "@vendetta/plugin";
import { Forms } from "@vendetta/ui/components";

const { FormSection, FormInput } = Forms;
const { ScrollView } = ReactNative;

export default function Settings() {
	useProxy(storage);

	return (
		<ScrollView style={{ flex: 1 }}>
			<FormSection title="VaultRelay Integration (For 15MB Dumps)">
				<FormInput
					title="Server URL"
					placeholder="https://xeon.systems/discord"
					value={storage.serverUrl ?? ""}
					onChange={(val: string) => {
						storage.serverUrl = val.replace(/\/+$/, "");
					}}
				/>
				<FormInput
					title="API Token"
					placeholder="Bearer Token"
					value={storage.apiToken ?? ""}
					onChange={(val: string) => {
						storage.apiToken = val;
					}}
					secureTextEntry
				/>
			</FormSection>
		</ScrollView>
	);
}
