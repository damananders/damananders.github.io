/* stream-chat.js — a custom, on-brand live chat for /stream/.
 *
 * Reads the Twitch channel's chat anonymously over IRC-over-WebSocket (no Twitch login needed to watch
 * the chat, no third-party embed/ads). Posting still happens on Twitch — a "Chat on Twitch" link is shown —
 * because sending requires the viewer's own Twitch auth.
 *
 *   window.StreamChat.mount(el, channel)   fill `el` with the live chat for `channel`
 *   window.StreamChat.unmount()            close the socket and clear
 */
(function () {
  "use strict";
  var doc = document, sock = null, box = null, wrap = null, chan = "", closed = true, tries = 0, timer = 0;
  var MAX = 220;

  function el(tag, attrs, kids) {
    var n = doc.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === "class") n.className = attrs[k]; else if (k === "text") n.textContent = attrs[k]; else if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function parseTags(s) { var o = {}; s.split(";").forEach(function (p) { var i = p.indexOf("="); if (i > 0) o[p.slice(0, i)] = p.slice(i + 1); }); return o; }
  function parse(line) {
    var tags = {}, rest = line;
    if (rest[0] === "@") { var sp = rest.indexOf(" "); tags = parseTags(rest.slice(1, sp)); rest = rest.slice(sp + 1); }
    var prefix = ""; if (rest[0] === ":") { var sp2 = rest.indexOf(" "); prefix = rest.slice(1, sp2); rest = rest.slice(sp2 + 1); }
    var sp3 = rest.indexOf(" :"); var head = sp3 < 0 ? rest : rest.slice(0, sp3); var trail = sp3 < 0 ? "" : rest.slice(sp3 + 2);
    var parts = head.split(" ");
    return { tags: tags, prefix: prefix, cmd: parts[0], params: parts.slice(1), trail: trail };
  }

  function atBottom() { return wrap && (wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 60); }
  function addMsg(name, color, text) {
    if (!box) return;
    var stick = atBottom();
    var line = el("div", { class: "sc-msg" }, [el("b", { class: "sc-name", text: name }), el("span", { class: "sc-text", text: ": " + text })]);
    if (color && /^#[0-9a-f]{6}$/i.test(color)) line.firstChild.style.color = color;
    box.appendChild(line);
    while (box.childNodes.length > MAX) box.removeChild(box.firstChild);
    if (stick && wrap) wrap.scrollTop = wrap.scrollHeight;
  }
  function note(text) { if (box) { box.appendChild(el("div", { class: "sc-note", text: text })); if (wrap) wrap.scrollTop = wrap.scrollHeight; } }

  function connect() {
    try { sock = new WebSocket("wss://irc-ws.chat.twitch.tv:443"); } catch (e) { retry(); return; }
    sock.onopen = function () {
      tries = 0;
      sock.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      sock.send("NICK justinfan" + (Math.floor(Math.random() * 80000) + 1000));
      sock.send("JOIN #" + chan);
    };
    sock.onmessage = function (ev) {
      String(ev.data || "").split("\r\n").forEach(function (line) {
        if (!line) return;
        if (line.indexOf("PING") === 0) { try { sock.send("PONG :tmi.twitch.tv"); } catch (e) {} return; }
        var m = parse(line);
        if (m.cmd === "PRIVMSG") {
          var name = m.tags["display-name"] || (m.prefix.split("!")[0]) || "someone";
          addMsg(name, m.tags.color, m.trail);
        } else if (m.cmd === "JOIN" && !closed) { /* joined */ }
      });
    };
    sock.onclose = function () { if (!closed) retry(); };
    sock.onerror = function () { try { sock.close(); } catch (e) {} };
  }
  function retry() {
    if (closed) return;
    tries++; if (tries > 6) { note("Chat disconnected. Reload to reconnect."); return; }
    clearTimeout(timer); timer = setTimeout(connect, Math.min(1000 * tries, 8000));
  }

  function mount(host, channel) {
    unmount();
    closed = false; chan = String(channel || "").toLowerCase();
    host.textContent = "";
    var head = el("div", { class: "sc-head" }, [el("span", { class: "sc-title", text: "Live chat" }),
      el("a", { class: "sc-post", href: "https://www.twitch.tv/" + encodeURIComponent(chan), target: "_blank", rel: "noopener", text: "Chat on Twitch →" })]);
    wrap = el("div", { class: "sc-scroll" });
    box = el("div", { class: "sc-msgs" });
    wrap.appendChild(box);
    host.appendChild(head); host.appendChild(wrap);
    note("Connecting to chat…");
    connect();
  }
  function unmount() {
    closed = true; clearTimeout(timer);
    if (sock) { try { sock.close(); } catch (e) {} sock = null; }
    box = wrap = null;
  }

  window.StreamChat = { mount: mount, unmount: unmount };
})();
