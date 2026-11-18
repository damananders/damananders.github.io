/* pages/games.steam.js: Linked accounts (/games/steam/). Prefix ln-.
 * "Sign in through Steam" uses Steam's own sign-in page (OpenID 2.0); the steam-link function confirms Steam's answer
 * with Steam before saving anything, so nobody can claim someone else's account. Unlinking deletes the stored data. */
import { sb, $, el, me, onAuth, authPill, subnav, signIn, toast, sfx, steamRow, steamCard, bnetRow, profileUrl } from "./games.common.js?v=34";

const root = $("ln-root");
const RETURN_TO = location.origin + "/games/steam/";
let busy = false;

onAuth(() => { authPill($("gm-auth"), { okTail: "." }); render(); });
subnav($("rop-tabs"), "ratings");

function steamLoginUrl() {
  const q = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0", "openid.mode": "checkid_setup",
    "openid.return_to": RETURN_TO, "openid.realm": location.origin + "/",
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select", "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select" });
  return "https://steamcommunity.com/openid/login?" + q.toString();
}

async function render() {
  const head = el("header", { class: "fx-head" }, el("h1", { class: "fx-h", text: "Linked accounts" }),
    el("p", { class: "gm-note", text: "Link your game accounts so your profile can show what you play. You can unlink any time." }));
  if (!me.user) { root.replaceChildren(head, el("p", { class: "gm-note" }, el("button", { class: "linkbtn", type: "button", onclick: signIn, text: "Sign in" }), " to link your accounts.")); return; }
  const params = Object.fromEntries([...new URLSearchParams(location.search)].filter(([k]) => k.startsWith("openid.")));
  if (params["openid.mode"] && !busy) {
    busy = true;
    root.replaceChildren(head, el("p", { class: "gm-empty", text: "Checking with Steam…" }));
    history.replaceState(null, "", "/games/steam/");
    if (params["openid.mode"] === "cancel") toast("Steam sign-in cancelled", "info");
    else {
      const { data, error } = await sb.functions.invoke("steam-link", { body: { action: "verify", params } });
      if (error || !data || !data.ok) toast((data && data.error) || "Linking didn't work. If this keeps happening, the steam-link function may not be set up yet.", "err");
      else { toast("Steam linked", "ok"); sfx("success"); }
    }
    busy = false;
  }
  const qs = new URLSearchParams(location.search);
  if ((qs.get("state") || "").startsWith("bnet-") && !busy) {
    busy = true;
    root.replaceChildren(head, el("p", { class: "gm-empty", text: "Checking with Battle.net…" }));
    history.replaceState(null, "", "/games/steam/");
    if (qs.get("code")) {
      const { data } = await sb.functions.invoke("bnet-link", { body: { action: "finish", code: qs.get("code"), state: qs.get("state") } });
      if (!data || !data.ok) toast((data && data.error) || "Linking Battle.net didn't work.", "err"); else { toast("Battle.net linked", "ok"); sfx("success"); }
    } else toast("Battle.net sign-in cancelled", "info");
    busy = false;
  }
  const handle = me.profile && me.profile.handle;
  const s = handle ? await steamRow(handle) : undefined;
  const bn = handle ? await bnetRow(handle) : undefined;
  const steamSec = el("section", { class: "fx-sec ln-sec" }, el("h2", { class: "gm-head", text: "Steam" }));
  if (s === undefined) steamSec.append(el("p", { class: "gm-note", text: "Steam linking switches on after the next database update (round 40)." }));
  else if (s) {
    const note = el("span", { class: "gm-note", role: "status" });
    steamSec.append(steamCard(s, false), el("div", { class: "fx-acts" },
      el("button", { class: "btn gm-btn", type: "button", text: "Refresh from Steam", onclick: async (e) => {
        e.currentTarget.disabled = true;
        const { data } = await sb.functions.invoke("steam-link", { body: { action: "refresh" } });
        note.textContent = data && data.cached ? "Already fresh (it updates at most every 6 hours)." : data && data.ok ? "Updated." : (data && data.error) || "Couldn't refresh.";
        if (data && data.ok && !data.cached) render();
      } }),
      el("button", { class: "linkbtn fx-decline", type: "button", text: "Unlink Steam", onclick: async () => {
        if (!confirm("Unlink Steam? Your Steam name, games and hours are deleted from Rate-O-Pedia.")) return;
        const { error } = await sb.rpc("unlink_steam"); if (error) { toast(error.message, "err"); return; }
        toast("Steam unlinked", "ok"); render();
      } }), note));
  } else {
    steamSec.append(
      el("a", { class: "ln-steam", href: steamLoginUrl(), html: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" opacity=".18"/><circle cx="15.5" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="15.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.4 14.4l3.2-3" stroke="currentColor" stroke-width="1.8"/></svg><span>Sign in through Steam</span>' }),
      el("ul", { class: "gm-note ln-fine" },
        el("li", { text: "You sign in on Steam's own page. Your Steam password never reaches this site." }),
        el("li", { text: "We store your Steam id, Steam name, avatar, number of games, total hours and your 6 most-played games. Games only show if your Steam \"Game details\" are public." }),
        el("li", { text: "Shown on your public profile. Unlinking deletes all of it." }),
        el("li", { text: "Rate-O-Pedia isn't affiliated with or endorsed by Valve or Steam." })));
  }
  const bnSec = el("section", { class: "fx-sec ln-sec" }, el("h2", { class: "gm-head", text: "Battle.net" }));
  if (bn === undefined) bnSec.append(el("p", { class: "gm-note", text: "Battle.net linking switches on after the next database update (round 41)." }));
  else if (bn) bnSec.append(el("div", { class: "ln-bn" }, el("span", { class: "ln-bn__tag", text: bn.battletag }), el("span", { class: "pf-ra__ok", text: " ✔ linked" })),
    el("button", { class: "linkbtn fx-decline", type: "button", text: "Unlink Battle.net", onclick: async () => {
      if (!confirm("Unlink Battle.net? Your BattleTag is deleted from Rate-O-Pedia.")) return;
      const { error } = await sb.rpc("unlink_bnet"); if (error) { toast(error.message, "err"); return; } toast("Battle.net unlinked", "ok"); render();
    } }));
  else bnSec.append(el("button", { class: "ln-bnet", type: "button", text: "Sign in with Battle.net", onclick: async (e) => {
      e.currentTarget.disabled = true;
      const { data } = await sb.functions.invoke("bnet-link", { body: { action: "start" } });
      e.currentTarget.disabled = false;
      if (data && data.ok && data.url) location.href = data.url; else toast((data && data.error) || "Battle.net linking isn't set up yet.", "err");
    } }),
    el("ul", { class: "gm-note ln-fine" }, el("li", { text: "You sign in on Battle.net's own page. We only receive and store your BattleTag and account number." }),
      el("li", { text: "Shown on your public profile. Unlinking deletes it. Not affiliated with or endorsed by Blizzard." })));
  root.replaceChildren(head, steamSec, bnSec, handle ? el("a", { class: "linkbtn", href: profileUrl(handle), text: "← Back to your profile" }) : null);
}
