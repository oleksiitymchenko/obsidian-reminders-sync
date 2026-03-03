import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

interface RemindersSyncSettings {
  // Add settings fields here
}

const DEFAULT_SETTINGS: RemindersSyncSettings = {
  // Add default values here
};

export default class RemindersSyncPlugin extends Plugin {
  settings: RemindersSyncSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new RemindersSyncSettingTab(this.app, this));

    console.log("Reminders Sync plugin loaded");
  }

  onunload() {
    console.log("Reminders Sync plugin unloaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class RemindersSyncSettingTab extends PluginSettingTab {
  plugin: RemindersSyncPlugin;

  constructor(app: App, plugin: RemindersSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Reminders Sync Settings" });

    // Add settings UI here
    new Setting(containerEl)
      .setName("Settings")
      .setDesc("Configure your reminders sync settings here.");
  }
}
