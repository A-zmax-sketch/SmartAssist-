# Contributing to SmartAssist

`main` always holds a working app. All work happens on a branch, comes in through a pull request, and Kachi reviews and merges it. Always commit from **your own** GitHub account so the history credits you.

## Your first task, step by step

You don't need to install anything for this: it all happens in the browser.

1. Open your task's **GitHub Issue**. It lists the branch name, the files to change, the commit message, and a plain-English explanation of the code.
2. Go to the repo on github.com and press the **`.`** key. This opens a code editor in your browser (github.dev).
3. Click the branch name at the bottom left, choose **Create new branch**, and type the name from the issue, for example `feature/read-aloud-screen`.
4. Add or edit the files the issue lists.
5. Open the **Source Control** panel (the branch icon on the left), type the commit message from the issue, and click **Commit & Push**.
6. Go back to the repo on github.com. Click **Compare & pull request**, write `Closes #12` (your issue's number) in the description, and click **Create pull request**.
7. Wait for the automatic checks (a green tick means they passed), then Kachi reviews and merges.

## Branch names

| Starts with | Use it for | Example |
| --- | --- | --- |
| `feature/` | New screens or features | `feature/settings-text-size` |
| `fix/` | Bug fixes | `fix/back-button-on-help` |
| `test/` | Tests only | `test/command-matcher` |
| `docs/` | Documents | `docs/device-test-log-week-2` |

## Commit messages

A type, a colon, then what changed, in under 70 characters:

- `feat: add Read Aloud screen layout`
- `fix: stop speech when leaving Read Aloud`
- `test: add unit tests for command matcher`
- `docs: add device test log for week 2`
- `style: apply high-contrast colours to Home tiles`

## Rules for the code

These keep the app accessible. Reviewers will check them.

1. **Build screens from the shared components** in `src/components`: `Screen`, `AppText`, `BigButton`, `Tile`. Don't use React Native's plain `<Text>` or `<Button>`.
2. **Never type a colour or font size into a screen.** Get them from `useAppTheme()`, so Settings (text size, High contrast) changes every screen.
3. **Every button has an icon and a word,** and a screen-reader label. `BigButton` and `Tile` do this for you; add a `hint` that says what the button does.
4. **At most 4 main actions per screen.**
5. **Check your screen at the biggest text size and in High contrast.** Text must wrap, never get cut off.

## General rules

- Never push straight to `main`.
- One task = one branch = one pull request.
- Read and understand the code you commit. Each issue explains it, so you can explain your part in the presentation.
- Working on a laptop instead of the browser? Set Git to use the email on your GitHub account first, or your commits won't show your name:

  ```bash
  git config --global user.email "the-email-on-your-github-account@example.com"
  ```

  Then run `npm test`, `npm run typecheck` and `npm run lint` before you push.
