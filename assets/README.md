# How this site is put together

Plain HTML, CSS and JavaScript on GitHub Pages. No build step. Paths starting with `/assets/` are absolute, so preview it from the repo root:

    python3 -m http.server 8080      # then open http://localhost:8080/

## Files and who owns them

| File | What it is |
| --- | --- |
| `assets/config.js` | **Do not restructure.** The AnyPS app's built-in updater downloads and reads this file (`SITE.anyps.version`, `exeUrl`, `downloadUrl`). The AnyPS release script rewrites it. |
| `assets/site-config.js` | Every other setting (`window.SITE_EXTRA`): social, Ko-fi goal, status endpoint, checksums, analytics, feature switches. Safe to edit by hand. |
| `assets/data/*.json` | Content that changes: `news.json`, `now.json`, `vault-meta.json`, plus page data. `demo-*.json` is test data only. |
| `assets/site.js` + `assets/fx.css` | Shared core (`window.Site`), tokens, light-theme base, small building blocks (`sx-` classes). |
| `assets/chrome.js` + `chrome.css` | Site-wide interface: sticky glass header, logo mark, theme switch and the finished light theme, settings panel, back-to-top, skip link, focus styles. |
| `assets/interact.js` + `interact.css` | Site-wide motion and input: cursor ring, page transitions, button press and ripple, controller navigation, easter egg. |
| `assets/audio.js` (+ `audio.css` on the hub) | Optional UI sounds and the hub soundscape. All sound is synthesised in the browser; nothing is downloaded. Always starts off. |
| `assets/social-live.js` + `.css` | Twitch live badge, Discord member count, Ko-fi goal bar. |
| `assets/analytics.js` | Loads GoatCounter only when a code is set in `site-config.js`. |
| `locker/index.html` + `assets/pages/locker.js/.css` | PS Locker: owner-only links from `locker.list` in `site-config.js` (noindex). Reached by clicking the faint mark at the bottom of the hub five times and typing a code (hashes live in `assets/pages/hub.js`). The code is a convenience, not security: keep the Drive items on Restricted sharing. |
| `assets/pages/<page>.js` + `.css` | Each page's own upgrades: `hub`, `hub-fx` (effects), `anderscraft`, `anyps-plus`, `vault`, `404`. |

Every page has two marked blocks, `<!-- site:head -->` in `<head>` and `<!-- site:scripts -->` before `</body>`. Keep them when editing a page.
`anyps/index.html` is maintained by the AnyPS release process: the upgrades for that page live entirely in `assets/pages/anyps-plus.js/.css` and attach themselves to the existing ids, so the page itself only carries those two blocks.

## The `Site` object (assets/site.js)

All site scripts load with `defer`, in order, after the page's own inline scripts have run. `window.Site` is ready when they start.

| Member | Use |
| --- | --- |
| `Site.page` | `"hub" \| "anderscraft" \| "anyps" \| "vault" \| "404"` (also `html[data-page]`). |
| `Site.config` / `Site.legacy` | `window.SITE_EXTRA` / `window.SITE` (config.js, may be `null` on pages that don't load it). |
| `Site.store.get(key, fallback)`, `.set(key, value)`, `.remove(key)` | localStorage as JSON under `site.<key>`. Never throws. |
| `Site.pref(name)`, `Site.setPref(name, value)` | Visitor preferences: `theme` (`dark`/`light`/`auto`), `motion` (`auto`/`off`), `cursor` (bool), `sfx` (bool), `soundscape` (bool), `volume` (0..1), `glyphs` (`ps`/`xbox`). `setPref` emits `pref:<name>`. |
| `Site.reducedMotion` | `true` when the OS asks for reduced motion or the visitor turned motion off. CSS equivalent: `:root[data-motion="reduce"]`. |
| `Site.theme.get() / .set(t) / .toggle()` | Current theme; CSS hook `:root[data-theme="light"]`. |
| `Site.owner` | `true` after this browser opened the site with `?owner` (`?owner=0` turns it off). CSS hook `:root[data-owner]`. |
| `Site.on(evt, fn)`, `Site.emit(evt, detail)` | Tiny event bus. `on` returns an unsubscribe function. |
| `Site.el(tag, attrs, ...children)` | DOM builder. `attrs`: `class`, `text` (safe), `html` (trusted constants only), `dataset`, `style` (object), `on<event>`, anything else becomes an attribute. |
| `Site.svg(innerMarkup, attrs)` | Builds a 24x24 stroke icon `<svg>` from trusted markup. |
| `Site.ready(fn, name)` | Runs `fn` now inside try/catch so one broken module can't stop the others. |
| `Site.toast(msg, {type:"info"\|"ok"\|"warn"\|"err", ms})` | Small message at the bottom of the screen. |
| `Site.copy(text, okMsg)` | Copies and toasts. Markup hook: `data-copy="text"` or `data-copy-target="#selector"`. |
| `Site.data(name)` | Promise of `/assets/data/<name>.json` (cached) or `null`. |
| `Site.news()` | Promise of news items, newest first: `{date, tag, title, body, url}`. |
| `Site.fetchJSON(url, {timeout, ttl, headers, text})` | Fetch that never rejects; `null` on any failure. `ttl` seconds caches in sessionStorage. |
| `Site.live.signup()` | Promise `"up" \| "down"`: is the AndersCraft sign-up service answering. |
| `Site.live.realms()` | Promise of the realm status object below, or `null` when `anderscraft.statusUrl` is blank or unreachable. |
| `Site.live.twitch()` | Promise `{live, uptime}` or `null` (unknown). |
| `Site.live.discord()` | Promise `{members, online, name}` or `null`. |
| `Site.live.releases()` | Promise `{tag, url, published, downloads, assets:[{name,size,downloads,url}]}` or `null` until `anyps.githubRepo` is set. |
| `Site.reveal(target)` | Fade-in on scroll. Markup hook: `data-reveal` (optionally `="left"`, `"right"`, `"zoom"`, and `data-reveal-delay="120"`). |
| `Site.modal({id, title, body, wide})` | Creates a `<dialog class="sx-modal">` (not opened). `Site.dialog.open(d)` / `.close(d)`. Markup hooks: `data-open="#id"`, `data-close`. |
| `Site.gamepad.on(fn)` | `fn(button, pad)` with `up down left right a b x y lb rb lt rt select start`; directions auto-repeat. Returns unsubscribe. |
| `Site.tools()` | The shared container (`#sx-tools`) at the right end of the header for small buttons. Place yours with `style="order:N"`: theme 10, settings 20, sound 30. |
| `Site.settings.register(row)` / `.list()` | Adds a row to the settings panel: `{id, label, hint, type:"toggle"\|"choice"\|"range", pref, choices:[{value,label}], min, max, step, pages, order}`. |
| `Site.sfx(name)` | Plays a UI sound if the visitor turned them on: `tap`, `hover`, `open`, `close`, `toggle`, `copy`, `toast`, `error`, `success`, `nav`. |
| `Site.fmtDate(iso)`, `Site.fmtNum(n)`, `Site.fmtBytes(b)` | Formatting. |
| `Site.debug(flag)` | Test switches from the address bar, e.g. `?sx=signup:up,twitch:live,discord:1234,status:demo,releases:demo,night`. |

Building blocks in `fx.css`: `.sx-chip` (+ `.is-on .is-off .is-wait .is-live`, with `<i class="sx-dot">`), `.sx-progress` (`--sx-p:40%`), `.sx-kbd`, `.sx-iconbtn`, `.sx-x`, `.sx-sr` (screen-reader only), toasts, `dialog.sx-modal`.
Tokens: `--sx-surface --sx-surface-2 --sx-glass --sx-line --sx-line-2 --sx-text --sx-muted --sx-accent --sx-on-accent --sx-ok --sx-warn --sx-err --sx-info --sx-display --sx-body --sx-mono --sx-shadow --sx-radius --sx-ease --sx-header-h`. For the page accent use `var(--accent, var(--sx-accent))`.
`--sx-photo-overlay` is the wash over full-page photo backgrounds (dark by default, light in the light theme).
Layers: page content 0-10, sticky header `--sx-z-header` (100), floating buttons `--sx-z-float` (200), popovers `--sx-z-pop` (300); toasts and the cursor ring sit above everything.

Class prefixes, so nothing collides: `sx-` core, `ch-` chrome, `ix-` interact, `au-` audio, `sl-` social, `hb-` hub, `hx-` hub effects, `ac-` AndersCraft, `ap-` AnyPS, `vt-` Vault, `nf-` 404.
Watch out on the AndersCraft page: its own stylesheet styles bare `button`, `input` and `label` elements (full width, top margin), so anything added there must reset those itself.

## AndersCraft status endpoint (optional)

`anderscraft.statusUrl` in `site-config.js` should return JSON like this, with CORS allowed for `https://damananders.github.io`. Character names only: never account names, emails or IP addresses.

    {
      "ok": true, "generated": "2026-11-11T12:00:00Z", "signup": true,
      "realms": [ { "id": 1, "name": "AndersCraft", "online": true, "players": 3, "bots": 412 },
                  { "id": 2, "name": "Andersian Hardcore", "online": true, "players": 1, "bots": 0 } ],
      "leaderboard": { "topLevel": [ { "name": "Thrall", "level": 125, "race": "Orc", "class": "Shaman", "realm": 1 } ],
                       "hardcore": [ { "name": "Jaina", "level": 61, "race": "Human", "class": "Mage", "alive": true } ] }
    }

Until it is set, the player counts and leaderboard simply don't appear.
