# Cherry 20 website auto-publish

`SiteSync.js` runs inside the **946 Cherry Asset Mgmt** sheet's bound Apps Script project
(script ID `1YnIWw2eQ3GKudGSqEMh4_aMT2nwKWANohaTTDWuot9GfD6XttwcHAS9Z`, next to `QboSync`,
`Menu` and `JournalEntry`, whose source lives in `str-analyzer/scripts/sheet-apps-script/`).
Once a day it syncs QuickBooks, rebuilds `src/data/owners/946-cherry.json`, adds any new
"Bidwell Cherry 20 - ... Update" email to the archive, checks everything, and either merges
the change to `main` (Render deploys `/cherry-20`) or emails you what looked wrong.

## What it does each morning (~7am Pacific)

1. **QuickBooks sync** of P&L + Balance Sheet from `QB_START_MONTH` through the end of last
   month. It never syncs the month in progress.
2. **Waits until last month is closed out in the sheet**: 20 Rent Roll rows, Monthly Inputs
   row filled, P&L NOI present, Dashboard showing that month. It also waits until the 3rd
   (`SITE_EARLIEST_DAY`) so late QuickBooks entries land first. If the month is still not
   ready on the 10th, you get an email listing what is missing.
3. **Builds the page data** from the Dashboard, P&L and Rent Roll. The summary, KPI notes
   and "This month" bullets are generated from the numbers. The Unit 10 rehab gallery and
   unit tags carry over. Vacant units show their last rent.
4. **Verifies** before publishing:
   - months advance one at a time, and the NOI chart ends at the new month
   - Rent Roll has one row per unit, and every occupied rent is $400-$2,000
   - occupancy is 75-100%
   - the new month's NOI is positive, 50%-160% of the 6-month median, and matches the Dashboard
   - revenue is within 30% of what the Rent Roll billed
   - no already-published month's NOI moved more than 2% or $300 (QuickBooks restatement)
   - implied value moved under 20%, T-12 NOI moved under 25%, the loan balance only paid
     down (by less than $5K), reserves are not negative, and delinquency is under $10K
   - no tenant name from the Rent Roll appears in the page data or the archived email
5. **Publishes**: one commit on an `auto/cherry-*` branch, a PR with a before/after table,
   squash merge, then the branch is deleted. About 30 minutes later it checks that the live
   page shows the new month and emails you if it does not.

If a check fails, nothing is published and you get one email listing the problems. The
same problem is not re-sent for 3 days. Fix the sheet and the next run retries. If the
numbers are right as they are (for example a real QuickBooks correction), use
**Website > Publish now (override failed checks)**.

If the month is already published and none of its numbers changed, nothing is republished.
Hand-edited text on the site stays until the next month or a real number change.

## One-time install

These steps change what the sheet's script is allowed to do (read Gmail, send mail, run on
a timer), so do them yourself.

1. **Code.** In the sheet, open Extensions > Apps Script and:
   - add a file `SiteSync` and paste in `SiteSync.js`
   - in `QboSync`, inside `runReportSync`, change
     `const range = opts.latestOnly ? singleMonthRange(layout) : fullRange(startMonth, layout);`
     to
     `const range = opts.range || (opts.latestOnly ? singleMonthRange(layout) : fullRange(startMonth, layout));`
   - in `Menu`, just before the closing `}` of `onOpen`, add:
     ```js
     ui.createMenu('Website')
       .addItem('Check now (sync QB, verify, publish nothing)', 'siteCheckNow')
       .addItem('Publish now', 'sitePublishNow')
       .addItem('Publish now (override failed checks)', 'sitePublishOverride')
       .addSeparator()
       .addItem('Install daily auto-publish', 'siteInstallTrigger')
       .addItem('Remove daily auto-publish', 'siteRemoveTrigger')
       .addItem('Set GitHub token', 'siteSetGithubToken')
       .addToUi();
     ```
   - in `appsscript.json` (Project Settings > show manifest), add these to `oauthScopes`:
     `script.scriptapp`, `script.send_mail`, `gmail.readonly`, `userinfo.email`
     (each prefixed with `https://www.googleapis.com/auth/`).
   Mirror the QboSync and Menu edits into `str-analyzer/scripts/sheet-apps-script/`.
2. **GitHub token.** Create a fine-grained PAT on github.com (Settings > Developer settings)
   for `adampenn/bidwellcapitalfund.com` only, with Contents: Read and write and Pull
   requests: Read and write. Reload the sheet, then Website > Set GitHub token and paste it.
3. **Dry run.** Website > Check now. Approve the new permissions when Google asks. It
   should report either "Nothing to change" or what it would publish.
4. **Turn it on.** Website > Install daily auto-publish. Alerts go to the account that
   installs it. Set the Script Property `SITE_ALERT_EMAIL` to send them elsewhere.

## Testing changes locally

The build and verify functions are plain JS. To test against live sheet data, export the
tabs with `gog sheets get <id> "<Tab>!A1:Z2000" --json`, pad the rows to rectangles, and run
`siteReadSheet_` / `siteBuildDoc_` / `siteVerify_` in Node with small `Utilities`,
`Session` and `PropertiesService` stubs, plus `QboSync.js` for the month helpers.
