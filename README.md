# EV Energy Advisor

Expo React Native application for V2G/V2H energy analysis and break-even point calculations.

## Android APK build

This repository uses Expo EAS Build through GitHub Actions.

1. Install Node.js and run `npm install` in this folder.
2. Sign in to Expo with `npx eas-cli@latest login`.
3. Link this app to your Expo account with `npx eas-cli@latest init` and commit the generated `extra.eas.projectId` in `app.json`.
4. Create an Expo access token in your Expo account settings.
5. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**. Name it `EXPO_TOKEN` and paste the token as its value.
6. Push the project to the `main` branch or manually run **Actions → Build EV Energy Advisor APK**.
7. When the workflow succeeds, download `EV-Energy-Advisor-APK` from the run's **Artifacts** section.

The `preview` EAS profile is configured to produce an installable Android APK. The `production` profile is configured for an Android App Bundle.
