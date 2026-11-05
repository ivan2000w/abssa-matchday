# ABSSA Matchday

An independent, mobile-friendly PWA for ABSSA Division 4B: every club's results,
fixtures and league position, favourite clubs, calendar export and offline access.

Live app: https://ivan2000w.github.io/abssa-matchday/

## Ownership and hosting

This repository contains the entire app, official-data collector and deployment
workflows. GitHub Pages hosts the app; GitHub Actions collects data and publishes
updates. No ChatGPT subscription, OpenAI account, local computer, external database
or private API key is needed for public ABSSA results or their updater.

The optional **My team** area uses Supabase for private accounts, SportEasy calendar,
availability and coach-controlled squads. See [team setup and calendar limitations](docs/team-attendance.md).

## Automatic updates

The **Update ABSSA and publish** workflow checks the official ABSSA website on
Saturdays at **19:35, 20:35 and 21:35 Europe/Brussels**, after the 19:30 release.
The timezone follows Belgian summer/winter time. GitHub may delay scheduled jobs;
these are target start times, not exact-minute guarantees.

Each run opens a fresh ABSSA session, reads all 26 matchdays and the 14-team table,
validates the data, writes the snapshot atomically, builds the app, records the
snapshot in Git, deploys it and checks the public timestamp. Missing rows, invalid
scores or failed source requests stop publication and preserve the last verified
snapshot. The collector retries temporary failures up to three times.

Open the repository's **Actions** tab to see runs and errors. To refresh immediately,
select **Update ABSSA and publish → Run workflow**. GitHub Actions notification
preferences control failure emails. The site displays when ABSSA was last checked.

Each successful refresh commits its source timestamp even if scores did not change.
GitHub can disable public-repository schedules after 60 days with no activity; after
a prolonged outage or off-season inactivity, check the Actions tab and re-enable
if needed. This collector intentionally validates the **2026/27, Division 4B**
season and must be reviewed before a new season; it will not relabel old data.

## Development

Requires Node 22.13+ and curl.

```sh
npm ci
npm run dev
npm test
npm run refresh:abssa
npm run build
```

`public/data/abssa.json` is the last verified official snapshot. It is not sample
data. The client fetches updates on opening, returning to the app and every two
minutes while visible. A cached offline copy is explicitly labelled.

For a repository path, build with `BASE_PATH=/abssa-matchday/ npm run build`.
The workflow obtains this path from GitHub Pages automatically. A custom domain
can be configured under repository Settings → Pages without changing the collector.

## Initial hosting setup

Enable GitHub Pages with **GitHub Actions** as its publishing source. Push to
`main`, or run the publish workflow manually. The built-in `GITHUB_TOKEN` gets only
the repository and Pages permissions declared in the workflow; no saved secret is
required. Keep the default branch as `main` or update the workflow accordingly.

## Data and club crests

Source: https://www.abssa.be/Abssabe-01. This is an unofficial companion app, not an
ABSSA service. Scores and standings are copied from ABSSA; the app never generates
results. The club identity file records official crest sources. Clubs without a
verified crest use labelled initials. Club logos remain their owners' property.
