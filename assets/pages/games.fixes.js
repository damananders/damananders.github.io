/* pages/games.fixes.js: game-info corrections (/games/fixes/). Prefix fx-.
 * Members see the corrections they suggested and how each went. Approvers (the owner and Discord Admins) also get
 * the queue: each suggestion shows what the card says now next to the suggested value, and can be tweaked before
 * approving. The database (round 39) checks who may approve; nothing here is trusted for that. */
import { sb, $, el, me, onAuth, authPill, subnav, consoleChip, gameUrl, nameLink, fmtWhen, toast, sfx, gameInfo, INFO_FIELDS, infoValue } from "./games.common.js?v=33";

const root = $("fx-root");
let tab = "pending";

onAuth(() => { authPill($("gm-auth"), { okTail: "." }); render(); });
subnav($("rop-tabs"), "ratings");

async function render() {
  if (!me.user) { root.replaceChildren(el("section", { class: "pf-card pf-notice" }, el("h2", { text: "Game info corrections" }), el("p", { class: "gm-note", text: "Sign in to see the corrections you've suggested." }))); return; }
  const approver = me.admin || me.staff;
  const parts = [el("header", { class: "fx-head" }, el("h1", { class: "fx-h", text: "Game info corrections" }),
    el("p", { class: "gm-note", text: approver ? "Approve or decline what members suggest. Approving updates the game's info card right away." : "Spotted something wrong on a game's card? Use \"Suggest a correction\" on its page. Here's how yours went." }))];
  if (approver) {
    const tabs = el("div", { class: "gm-rankby fx-tabs", role: "group", "aria-label": "Show" },
      ...[["pending", "Waiting"], ["approved", "Approved"], ["declined", "Declined"]].map(([k, l]) =>
        el("button", { class: "gm-tab" + (tab === k ? " is-on" : ""), type: "button", "aria-pressed": tab === k ? "true" : "false", text: l, onclick: () => { tab = k; render(); } })));
    const q = el("div", { class: "fx-list" }, el("p", { class: "gm-empty", text: "Loading…" }));
    parts.push(el("section", { class: "fx-sec" }, el("h2", { class: "gm-head", text: "Queue" }), tabs, q));
    queue(q);
  }
  const mine = el("div", { class: "fx-list" }, el("p", { class: "gm-empty", text: "Loading…" }));
  parts.push(el("section", { class: "fx-sec" }, el("h2", { class: "gm-head", text: "Your suggestions" }), mine));
  root.replaceChildren(...parts);
  const { data, error } = await sb.rpc("my_game_suggestions");
  if (error) { mine.replaceChildren(el("p", { class: "gm-note", text: /function|schema cache/i.test(error.message) ? "Corrections switch on after the next database update (round 39)." : error.message })); return; }
  mine.replaceChildren(...(data || []).map((s) => item(s, false)));
  if (!(data || []).length) mine.append(el("p", { class: "gm-empty", text: "You haven't suggested any corrections yet." }));
}

async function queue(box) {
  const { data, error } = await sb.rpc("game_suggestion_queue", { p_status: tab });
  if (error) { box.replaceChildren(el("p", { class: "gm-note", text: /function|schema cache/i.test(error.message) ? "The queue switches on after the next database update (round 39)." : error.message })); return; }
  box.replaceChildren(...(data || []).map((s) => item(s, true)));
  if (!(data || []).length) box.append(el("p", { class: "gm-empty", text: tab === "pending" ? "Nothing waiting. All caught up." : "None yet." }));
}

const STATUS = { pending: ["Waiting", "fx-st--wait"], approved: ["Approved", "fx-st--ok"], declined: ["Declined", "fx-st--no"] };
function item(s, asApprover) {
  const [label, cls] = STATUS[s.status] || STATUS.pending;
  const card = el("article", { class: "fx-item" });
  const head = el("header", { class: "fx-item__head" }, consoleChip(s.console), el("a", { class: "fx-item__t", href: gameUrl(s.game_id), text: s.title }),
    el("span", { class: "fx-st " + cls, text: label }),
    el("span", { class: "gm-note fx-item__when", text: (asApprover && s.handle ? "" : "") + fmtWhen(s.created_at) }));
  if (asApprover && s.handle) head.append(el("span", { class: "gm-note" }, "from ", nameLink(s.handle, s.name)));
  const rows = el("div", { class: "fx-diff" });
  const inputs = {};
  card.append(head);
  if (s.note) card.append(el("p", { class: "fx-note", text: "“" + s.note + "”" }));
  card.append(rows);
  gameInfo(s.game_id).then((base) => {
    const now = Object.assign({}, base || {}, s.current || {});
    for (const [k, name, kind] of INFO_FIELDS) {
      if (!(k in (s.fields || {}))) continue;
      const was = infoValue(now[k]), want = infoValue(s.fields[k]);
      let right;
      if (asApprover && s.status === "pending") {
        inputs[k] = el(kind === "long" ? "textarea" : "input", { class: kind === "long" ? "gm-ta" : "gm-search pf-in", rows: kind === "long" ? "4" : null, "aria-label": name });
        inputs[k].value = want; right = inputs[k];
      } else right = el("div", { class: "fx-val fx-val--new", text: want });
      rows.append(el("div", { class: "fx-row" }, el("span", { class: "fx-k", text: name }),
        el("div", { class: "fx-val fx-val--old", text: was || "(empty)" }), el("span", { class: "fx-arrow", "aria-hidden": "true", text: "→" }), right));
    }
  }, () => {});
  if (s.reply || s.decided_by) card.append(el("p", { class: "gm-note fx-reply" }, s.decided_by ? s.decided_by + (s.reply ? ": " : "") : "", s.reply ? "“" + s.reply + "”" : ""));
  if (asApprover && s.status === "pending") {
    const reply = el("input", { class: "gm-search pf-in fx-replyin", maxlength: "300", placeholder: "Optional note to the member", "aria-label": "Note to the member" });
    const note = el("span", { class: "gm-note", role: "status" });
    const decide = async (approve, b) => {
      let fields = null;
      if (approve) {
        fields = {};
        for (const [k, , kind] of INFO_FIELDS) if (inputs[k]) {
          const v = inputs[k].value.trim(); if (!v) continue;
          fields[k] = kind === "list" ? v.split(",").map((x) => x.trim()).filter(Boolean) : kind === "year" ? +v : v;
        }
      }
      b.disabled = true;
      const { data, error } = await sb.rpc("decide_game_suggestion", { p_id: s.id, p_approve: approve, p_reply: reply.value, p_fields: fields });
      b.disabled = false;
      if (error || !data || !data.ok) { note.textContent = (data && data.error) || (error && error.message) || "That didn't save."; return; }
      sfx(approve ? "success" : "tap"); toast(approve ? "Approved: the card is updated" : "Declined", "ok");
      card.remove();
    };
    card.append(el("div", { class: "fx-acts" }, reply,
      el("button", { class: "btn gm-btn", type: "button", text: "Approve", onclick: (e) => decide(true, e.currentTarget) }),
      el("button", { class: "linkbtn fx-decline", type: "button", text: "Decline", onclick: (e) => decide(false, e.currentTarget) }), note));
  }
  return card;
}
