/**
 * SmartAssist's iPhone set-up, run by `npx expo prebuild` / `npx expo run:ios`.
 * Owner: Kosisochukwu.
 *
 * - Adds the permission messages iPhone shows for the microphone, speech
 *   recognition and contacts.
 * - Lists the app links SmartAssist may check for ("open WhatsApp"), taken
 *   from iphoneApps in voice-commands.json. iPhone only lets an app ask
 *   whether another app is installed if its link is listed here.
 * - Copies app-intents/SmartAssistShortcuts.swift into the iPhone app, so
 *   "Hey Siri, talk to SmartAssist" and the Action Button work. Apple only
 *   finds Siri shortcuts in the app itself, not in a module.
 *
 * ios/ is generated, so never edit it by hand: change this file instead.
 */
const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const voice = require('./android/src/main/assets/voice-commands.json');

const SHORTCUTS_FILE = 'SmartAssistShortcuts.swift';

const PERMISSION_MESSAGES = {
  NSMicrophoneUsageDescription: 'SmartAssist listens when you give it a voice command, like “Open WhatsApp”.',
  NSSpeechRecognitionUsageDescription: 'SmartAssist turns what you say into words, so it can do what you ask.',
  NSContactsUsageDescription: 'SmartAssist looks up the person you name, for example when you say “Call Mum”.',
};

/** Links that open in the browser or Settings don't need to be listed. */
const NOT_LISTED = ['http', 'https', 'app-settings'];

function appLinkSchemes() {
  return voice.iphoneApps.map((app) => app.link.split(':')[0]).filter((scheme) => !NOT_LISTED.includes(scheme));
}

function withSmartAssistIos(config) {
  config = withInfoPlist(config, (cfg) => {
    Object.assign(cfg.modResults, PERMISSION_MESSAGES);
    const schemes = new Set([...(cfg.modResults.LSApplicationQueriesSchemes ?? []), ...appLinkSchemes()]);
    cfg.modResults.LSApplicationQueriesSchemes = [...schemes];
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
      const destination = path.join(cfg.modRequest.platformProjectRoot, projectName, SHORTCUTS_FILE);
      fs.copyFileSync(path.join(__dirname, 'app-intents', SHORTCUTS_FILE), destination);
      return cfg;
    },
  ]);

  config = withXcodeProject(config, (cfg) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${projectName}/${SHORTCUTS_FILE}`,
      groupName: projectName,
      project: cfg.modResults,
    });
    return cfg;
  });

  return config;
}

module.exports = withSmartAssistIos;
