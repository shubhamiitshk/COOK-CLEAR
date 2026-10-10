# CookClear

A tablet-first cooking prototype for the **Messy Hands** design brief. Follow a six-step tomato basil pasta recipe with large controls, independent timers, saved progress, and optional voice navigation.

- [Current live prototype](https://cook-clear.netlify.app/)
- [Complete submission PDF](https://cook-clear.netlify.app/case-study.pdf)

## Run locally

Use Node.js **24.14.1**, the version verified for this project.

```sh
npm ci
npm run dev
```

For a production build and local preview:

```sh
npm run build
npm run preview
```

Run the ten session and timer checks with `npm test`.

## Deploy with Netlify

1. In Netlify, choose **Add new project → Import an existing project**.
2. Connect GitHub and select **shubhamiitshk/COOK-CLEAR**.
3. Deploy the **main** branch. Leave the base directory blank.

The committed `netlify.toml` supplies the build settings:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | `24.14.1` |

No environment secrets or backend are required. Netlify installs dependencies using the committed lockfile. Keep development dependencies enabled; they contain the Vite build tools.

After deployment, the prototype is at the site's root and the case study is at **`/case-study.pdf`**. For a short walkthrough, append **`?demo=1`** to the prototype URL to use accelerated timers.

Netlify guidance: [Vite setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/), [Node configuration](https://docs.netlify.com/build/configure-builds/manage-dependencies/).

## Interaction notes

- Progress and timer deadlines are stored in the current browser's local storage. Resetting the session clears that progress.
- Voice navigation is optional and depends on browser support and microphone permission. Use “next step”, “previous step”, or “read step”. Touch controls remain available.
- Sound is opt-in. Timer alerts work while the app is open; background delivery and wake lock depend on the browser.
- The layout has been checked across seven landscape sizes and portrait/mobile views. Participant testing has not been conducted; the case study states this limitation.

## Project layout

- `src/`: React interface, recipe content, session/timer logic, and browser feature hooks.
- `public/images/`: Cooking photography.
- `public/case-study.pdf`: Complete 24-page submission with the case study, all six steps in tablet and phone layouts, timer states, completion, help, reset, verification, and clickable reviewer links.
- `tests/`: Session and timer checks using Node's built-in test runner.

Built with React 19 and Vite 8.
