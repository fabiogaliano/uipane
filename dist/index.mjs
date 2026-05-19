import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
//#region src/config.ts
function parseConfig(config, prefix) {
	const controls = [];
	for (const [key, entry] of Object.entries(config)) {
		const meta = controlToMeta(entry, prefix ? `${prefix}.${key}` : key, formatLabel(key));
		if (meta) controls.push(meta);
	}
	return controls;
}
function flattenValues(config, prefix) {
	const values = {};
	for (const [key, entry] of Object.entries(config)) {
		const path = prefix ? `${prefix}.${key}` : key;
		switch (entry.type) {
			case "slider":
				values[path] = entry.value;
				break;
			case "toggle":
				values[path] = entry.value;
				break;
			case "action":
				values[path] = entry;
				break;
			case "slot": break;
			case "select": {
				const first = entry.options[0];
				const firstValue = typeof first === "string" ? first : first?.value ?? "";
				values[path] = entry.value ?? firstValue;
				break;
			}
			case "color":
				values[path] = entry.value ?? "#000000";
				break;
			case "text":
				values[path] = entry.value ?? "";
				break;
			case "spring":
				values[path] = entry;
				break;
			case "easing":
				values[path] = entry;
				break;
			case "folder":
				Object.assign(values, flattenValues(entry.children, path));
				break;
		}
	}
	return values;
}
function controlToMeta(entry, path, label) {
	switch (entry.type) {
		case "slider": return {
			type: "slider",
			path,
			label,
			min: entry.min,
			max: entry.max,
			step: entry.step ?? inferStep(entry.min, entry.max)
		};
		case "toggle": return {
			type: "toggle",
			path,
			label
		};
		case "action": return {
			type: "action",
			path,
			label: entry.label ?? label
		};
		case "select": return {
			type: "select",
			path,
			label,
			options: entry.options
		};
		case "color": return {
			type: "color",
			path,
			label
		};
		case "text": return {
			type: "text",
			path,
			label,
			placeholder: entry.placeholder
		};
		case "slot": return {
			type: "slot",
			path,
			label: entry.label ?? ""
		};
		case "spring": return {
			type: "transition",
			path,
			label
		};
		case "easing": return {
			type: "transition",
			path,
			label
		};
		case "folder": return {
			type: "folder",
			path,
			label,
			defaultOpen: entry.open ?? true,
			children: parseConfig(entry.children, path)
		};
	}
}
function formatLabel(key) {
	return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}
function inferStep(min, max) {
	const range = max - min;
	if (range <= 1) return .01;
	if (range <= 10) return .1;
	if (range <= 100) return 1;
	return 10;
}
function normalizeSelectOptions(options) {
	return options.map((opt) => typeof opt === "string" ? {
		value: opt,
		label: opt.replace(/\b\w/g, (c) => c.toUpperCase())
	} : opt);
}
//#endregion
//#region src/store.ts
const EMPTY_VALUES = Object.freeze({});
var PaneStoreClass = class {
	panels = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Map();
	globalListeners = /* @__PURE__ */ new Set();
	snapshots = /* @__PURE__ */ new Map();
	actionListeners = /* @__PURE__ */ new Map();
	presets = /* @__PURE__ */ new Map();
	activePreset = /* @__PURE__ */ new Map();
	baseValues = /* @__PURE__ */ new Map();
	transitionModes = /* @__PURE__ */ new Map();
	slotNodes = /* @__PURE__ */ new Map();
	slotListeners = /* @__PURE__ */ new Map();
	activeTabName = null;
	activeTabListeners = /* @__PURE__ */ new Set();
	setActiveTab(name) {
		if (this.activeTabName === name) return;
		this.activeTabName = name;
		this.activeTabListeners.forEach((fn) => fn());
	}
	getActiveTab() {
		return this.activeTabName;
	}
	subscribeActiveTab(listener) {
		this.activeTabListeners.add(listener);
		return () => this.activeTabListeners.delete(listener);
	}
	registerPanel(id, name, config) {
		const controls = parseConfig(config, "");
		const values = flattenValues(config, "");
		this.initTransitionModes(config, "", id);
		this.panels.set(id, {
			id,
			name,
			controls,
			values
		});
		this.snapshots.set(id, { ...values });
		this.baseValues.set(id, { ...values });
		this.notifyGlobal();
	}
	updatePanel(id, name, config) {
		const existing = this.panels.get(id);
		if (!existing) {
			this.registerPanel(id, name, config);
			return;
		}
		const controls = parseConfig(config, "");
		const newDefaults = flattenValues(config, "");
		const nextValues = {};
		for (const [path, defaultValue] of Object.entries(newDefaults)) {
			const prev = existing.values[path];
			nextValues[path] = prev !== void 0 && typeof prev === typeof defaultValue ? prev : defaultValue;
		}
		this.initTransitionModes(config, "", id);
		this.panels.set(id, {
			id,
			name,
			controls,
			values: nextValues
		});
		this.snapshots.set(id, { ...nextValues });
		this.notify(id);
		this.notifyGlobal();
	}
	unregisterPanel(id) {
		const prefix = `${id}:`;
		for (const key of this.slotNodes.keys()) if (key.startsWith(prefix)) {
			this.slotNodes.delete(key);
			this.slotListeners.get(key)?.forEach((fn) => fn());
			this.slotListeners.delete(key);
		}
		this.panels.delete(id);
		this.listeners.delete(id);
		this.snapshots.delete(id);
		this.actionListeners.delete(id);
		this.baseValues.delete(id);
		this.notifyGlobal();
	}
	updateValue(panelId, path, value) {
		const panel = this.panels.get(panelId);
		if (!panel) return;
		panel.values[path] = value;
		const activeId = this.activePreset.get(panelId);
		if (activeId) {
			const preset = (this.presets.get(panelId) ?? []).find((p) => p.id === activeId);
			if (preset) preset.values[path] = value;
		} else {
			const base = this.baseValues.get(panelId);
			if (base) base[path] = value;
		}
		this.snapshots.set(panelId, { ...panel.values });
		this.notify(panelId);
	}
	getValue(panelId, path) {
		return this.panels.get(panelId)?.values[path];
	}
	getValues(panelId) {
		return this.snapshots.get(panelId) ?? EMPTY_VALUES;
	}
	getPanels() {
		return Array.from(this.panels.values());
	}
	getPanel(id) {
		return this.panels.get(id);
	}
	subscribe(panelId, listener) {
		let set = this.listeners.get(panelId);
		if (!set) {
			set = /* @__PURE__ */ new Set();
			this.listeners.set(panelId, set);
		}
		set.add(listener);
		return () => set.delete(listener);
	}
	subscribeGlobal(listener) {
		this.globalListeners.add(listener);
		return () => this.globalListeners.delete(listener);
	}
	setSlotNode(panelId, path, node) {
		const key = `${panelId}:${path}`;
		if (node) {
			if (this.slotNodes.get(key) === node) return;
			this.slotNodes.set(key, node);
		} else {
			if (!this.slotNodes.has(key)) return;
			this.slotNodes.delete(key);
		}
		this.slotListeners.get(key)?.forEach((fn) => fn());
	}
	getSlotNode(panelId, path) {
		return this.slotNodes.get(`${panelId}:${path}`) ?? null;
	}
	subscribeSlot(panelId, path, listener) {
		const key = `${panelId}:${path}`;
		let set = this.slotListeners.get(key);
		if (!set) {
			set = /* @__PURE__ */ new Set();
			this.slotListeners.set(key, set);
		}
		set.add(listener);
		return () => set.delete(listener);
	}
	subscribeActions(panelId, listener) {
		let set = this.actionListeners.get(panelId);
		if (!set) {
			set = /* @__PURE__ */ new Set();
			this.actionListeners.set(panelId, set);
		}
		set.add(listener);
		return () => set.delete(listener);
	}
	triggerAction(panelId, path) {
		this.actionListeners.get(panelId)?.forEach((fn) => fn(path));
	}
	savePreset(panelId, name) {
		const panel = this.panels.get(panelId);
		if (!panel) throw new Error(`Panel ${panelId} not found`);
		const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
		const preset = {
			id,
			name,
			values: { ...panel.values }
		};
		const existing = this.presets.get(panelId) ?? [];
		this.presets.set(panelId, [...existing, preset]);
		this.activePreset.set(panelId, id);
		this.snapshots.set(panelId, { ...panel.values });
		this.notify(panelId);
		return id;
	}
	loadPreset(panelId, presetId) {
		const panel = this.panels.get(panelId);
		if (!panel) return;
		const preset = (this.presets.get(panelId) ?? []).find((p) => p.id === presetId);
		if (!preset) return;
		panel.values = { ...preset.values };
		this.snapshots.set(panelId, { ...panel.values });
		this.activePreset.set(panelId, presetId);
		this.notify(panelId);
	}
	deletePreset(panelId, presetId) {
		const presets = this.presets.get(panelId) ?? [];
		this.presets.set(panelId, presets.filter((p) => p.id !== presetId));
		if (this.activePreset.get(panelId) === presetId) this.activePreset.set(panelId, null);
		const panel = this.panels.get(panelId);
		if (panel) this.snapshots.set(panelId, { ...panel.values });
		this.notify(panelId);
	}
	clearActivePreset(panelId) {
		const panel = this.panels.get(panelId);
		const base = this.baseValues.get(panelId);
		if (panel && base) {
			panel.values = { ...base };
			this.snapshots.set(panelId, { ...panel.values });
		}
		this.activePreset.set(panelId, null);
		this.notify(panelId);
	}
	getPresets(panelId) {
		return this.presets.get(panelId) ?? [];
	}
	getActivePresetId(panelId) {
		return this.activePreset.get(panelId) ?? null;
	}
	getTransitionMode(panelId, path) {
		return this.transitionModes.get(`${panelId}:${path}`) ?? "simple";
	}
	setTransitionMode(panelId, path, mode) {
		this.transitionModes.set(`${panelId}:${path}`, mode);
		this.notify(panelId);
	}
	initTransitionModes(config, prefix, panelId) {
		for (const [key, entry] of Object.entries(config)) {
			const path = prefix ? `${prefix}.${key}` : key;
			if (entry.type === "easing") this.transitionModes.set(`${panelId}:${path}`, "easing");
			else if (entry.type === "spring") {
				const hasPhysics = entry.stiffness !== void 0 || entry.damping !== void 0 || entry.mass !== void 0;
				const hasTime = entry.visualDuration !== void 0 || entry.bounce !== void 0;
				this.transitionModes.set(`${panelId}:${path}`, hasPhysics && !hasTime ? "advanced" : "simple");
			} else if (entry.type === "folder") this.initTransitionModes(entry.children, path, panelId);
		}
	}
	notify(panelId) {
		this.listeners.get(panelId)?.forEach((fn) => fn());
	}
	notifyGlobal() {
		this.globalListeners.forEach((fn) => fn());
	}
};
const PaneStore = new PaneStoreClass();
//#endregion
//#region src/react/usePane.ts
function usePane(name, config, options) {
	const panelId = `${name}-${useId()}`;
	const configRef = useRef(config);
	configRef.current = config;
	const serialized = JSON.stringify(config);
	const onActionRef = useRef(options?.onAction);
	onActionRef.current = options?.onAction;
	useEffect(() => {
		PaneStore.registerPanel(panelId, name, configRef.current);
		return () => PaneStore.unregisterPanel(panelId);
	}, [panelId, name]);
	const mountedRef = useRef(false);
	useEffect(() => {
		if (!mountedRef.current) {
			mountedRef.current = true;
			return;
		}
		PaneStore.updatePanel(panelId, name, configRef.current);
	}, [
		panelId,
		name,
		serialized
	]);
	useEffect(() => {
		return PaneStore.subscribeActions(panelId, (action) => {
			onActionRef.current?.(action);
		});
	}, [panelId]);
	return buildResolved(config, useSyncExternalStore((cb) => PaneStore.subscribe(panelId, cb), () => PaneStore.getValues(panelId), () => PaneStore.getValues(panelId)), "");
}
function buildResolved(config, flat, prefix) {
	const result = {};
	for (const [key, entry] of Object.entries(config)) {
		const path = prefix ? `${prefix}.${key}` : key;
		switch (entry.type) {
			case "action": break;
			case "slot": break;
			case "slider":
				result[key] = flat[path] ?? entry.value;
				break;
			case "toggle":
				result[key] = flat[path] ?? entry.value;
				break;
			case "select": {
				const cfg = entry;
				const first = cfg.options[0];
				const firstVal = typeof first === "string" ? first : first?.value ?? "";
				result[key] = flat[path] ?? cfg.value ?? firstVal;
				break;
			}
			case "color":
				result[key] = flat[path] ?? entry.value ?? "#000000";
				break;
			case "text":
				result[key] = flat[path] ?? entry.value ?? "";
				break;
			case "spring":
				result[key] = flat[path] ?? entry;
				break;
			case "easing":
				result[key] = flat[path] ?? entry;
				break;
			case "folder":
				result[key] = buildResolved(entry.children, flat, path);
				break;
		}
	}
	return result;
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.0/node_modules/preact/dist/preact.mjs
var n, l$1, u$2, i$2, r$1, o$2, e$1, f$2, c$1, s$1, a$1, p$1 = {}, v$1 = [], y$1 = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i, d$1 = Array.isArray;
function w$1(n, l) {
	for (var u in l) n[u] = l[u];
	return n;
}
function g$1(n) {
	n && n.parentNode && n.parentNode.removeChild(n);
}
function _$1(l, u, t) {
	var i, r, o, e = {};
	for (o in u) "key" == o ? i = u[o] : "ref" == o ? r = u[o] : e[o] = u[o];
	if (arguments.length > 2 && (e.children = arguments.length > 3 ? n.call(arguments, 2) : t), "function" == typeof l && null != l.defaultProps) for (o in l.defaultProps) void 0 === e[o] && (e[o] = l.defaultProps[o]);
	return m$1(l, e, i, r, null);
}
function m$1(n, t, i, r, o) {
	var e = {
		type: n,
		props: t,
		key: i,
		ref: r,
		__k: null,
		__: null,
		__b: 0,
		__e: null,
		__c: null,
		constructor: void 0,
		__v: null == o ? ++u$2 : o,
		__i: -1,
		__u: 0
	};
	return null == o && null != l$1.vnode && l$1.vnode(e), e;
}
function k$1(n) {
	return n.children;
}
function x(n, l) {
	this.props = n, this.context = l;
}
function S(n, l) {
	if (null == l) return n.__ ? S(n.__, n.__i + 1) : null;
	for (var u; l < n.__k.length; l++) if (null != (u = n.__k[l]) && null != u.__e) return u.__e;
	return "function" == typeof n.type ? S(n) : null;
}
function C$1(n) {
	if (n.__P && n.__d) {
		var u = n.__v, t = u.__e, i = [], r = [], o = w$1({}, u);
		o.__v = u.__v + 1, l$1.vnode && l$1.vnode(o), z$1(n.__P, o, u, n.__n, n.__P.namespaceURI, 32 & u.__u ? [t] : null, i, null == t ? S(u) : t, !!(32 & u.__u), r), o.__v = u.__v, o.__.__k[o.__i] = o, V$1(i, o, r), u.__e = u.__ = null, o.__e != t && M$1(o);
	}
}
function M$1(n) {
	if (null != (n = n.__) && null != n.__c) return n.__e = n.__c.base = null, n.__k.some(function(l) {
		if (null != l && null != l.__e) return n.__e = n.__c.base = l.__e;
	}), M$1(n);
}
function $$1(n) {
	(!n.__d && (n.__d = !0) && i$2.push(n) && !I.__r++ || r$1 != l$1.debounceRendering) && ((r$1 = l$1.debounceRendering) || o$2)(I);
}
function I() {
	try {
		for (var n, l = 1; i$2.length;) i$2.length > l && i$2.sort(e$1), n = i$2.shift(), l = i$2.length, C$1(n);
	} finally {
		i$2.length = I.__r = 0;
	}
}
function P$1(n, l, u, t, i, r, o, e, f, c, s) {
	var a, h, y, d, w, g, _, m = t && t.__k || v$1, b = l.length;
	for (f = A$2(u, l, m, f, b), a = 0; a < b; a++) null != (y = u.__k[a]) && (h = -1 != y.__i && m[y.__i] || p$1, y.__i = a, g = z$1(n, y, h, i, r, o, e, f, c, s), d = y.__e, y.ref && h.ref != y.ref && (h.ref && D$1(h.ref, null, y), s.push(y.ref, y.__c || d, y)), null == w && null != d && (w = d), (_ = !!(4 & y.__u)) || h.__k === y.__k ? f = H$1(y, f, n, _) : "function" == typeof y.type && void 0 !== g ? f = g : d && (f = d.nextSibling), y.__u &= -7);
	return u.__e = w, f;
}
function A$2(n, l, u, t, i) {
	var r, o, e, f, c, s = u.length, a = s, h = 0;
	for (n.__k = new Array(i), r = 0; r < i; r++) null != (o = l[r]) && "boolean" != typeof o && "function" != typeof o ? ("string" == typeof o || "number" == typeof o || "bigint" == typeof o || o.constructor == String ? o = n.__k[r] = m$1(null, o, null, null, null) : d$1(o) ? o = n.__k[r] = m$1(k$1, { children: o }, null, null, null) : void 0 === o.constructor && o.__b > 0 ? o = n.__k[r] = m$1(o.type, o.props, o.key, o.ref ? o.ref : null, o.__v) : n.__k[r] = o, f = r + h, o.__ = n, o.__b = n.__b + 1, e = null, -1 != (c = o.__i = T$2(o, u, f, a)) && (a--, (e = u[c]) && (e.__u |= 2)), null == e || null == e.__v ? (-1 == c && (i > s ? h-- : i < s && h++), "function" != typeof o.type && (o.__u |= 4)) : c != f && (c == f - 1 ? h-- : c == f + 1 ? h++ : (c > f ? h-- : h++, o.__u |= 4))) : n.__k[r] = null;
	if (a) for (r = 0; r < s; r++) null != (e = u[r]) && 0 == (2 & e.__u) && (e.__e == t && (t = S(e)), E$1(e, e));
	return t;
}
function H$1(n, l, u, t) {
	var i, r;
	if ("function" == typeof n.type) {
		for (i = n.__k, r = 0; i && r < i.length; r++) i[r] && (i[r].__ = n, l = H$1(i[r], l, u, t));
		return l;
	}
	n.__e != l && (t && (l && n.type && !l.parentNode && (l = S(n)), u.insertBefore(n.__e, l || null)), l = n.__e);
	do
		l = l && l.nextSibling;
	while (null != l && 8 == l.nodeType);
	return l;
}
function L$1(n, l) {
	return l = l || [], null == n || "boolean" == typeof n || (d$1(n) ? n.some(function(n) {
		L$1(n, l);
	}) : l.push(n)), l;
}
function T$2(n, l, u, t) {
	var i, r, o, e = n.key, f = n.type, c = l[u], s = null != c && 0 == (2 & c.__u);
	if (null === c && null == e || s && e == c.key && f == c.type) return u;
	if (t > (s ? 1 : 0)) {
		for (i = u - 1, r = u + 1; i >= 0 || r < l.length;) if (null != (c = l[o = i >= 0 ? i-- : r++]) && 0 == (2 & c.__u) && e == c.key && f == c.type) return o;
	}
	return -1;
}
function j$2(n, l, u) {
	"-" == l[0] ? n.setProperty(l, null == u ? "" : u) : n[l] = null == u ? "" : "number" != typeof u || y$1.test(l) ? u : u + "px";
}
function F$1(n, l, u, t, i) {
	var r, o;
	n: if ("style" == l) if ("string" == typeof u) n.style.cssText = u;
	else {
		if ("string" == typeof t && (n.style.cssText = t = ""), t) for (l in t) u && l in u || j$2(n.style, l, "");
		if (u) for (l in u) t && u[l] == t[l] || j$2(n.style, l, u[l]);
	}
	else if ("o" == l[0] && "n" == l[1]) r = l != (l = l.replace(f$2, "$1")), o = l.toLowerCase(), l = o in n || "onFocusOut" == l || "onFocusIn" == l ? o.slice(2) : l.slice(2), n.l || (n.l = {}), n.l[l + r] = u, u ? t ? u.u = t.u : (u.u = c$1, n.addEventListener(l, r ? a$1 : s$1, r)) : n.removeEventListener(l, r ? a$1 : s$1, r);
	else {
		if ("http://www.w3.org/2000/svg" == i) l = l.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
		else if ("width" != l && "height" != l && "href" != l && "list" != l && "form" != l && "tabIndex" != l && "download" != l && "rowSpan" != l && "colSpan" != l && "role" != l && "popover" != l && l in n) try {
			n[l] = null == u ? "" : u;
			break n;
		} catch (n) {}
		"function" == typeof u || (null == u || !1 === u && "-" != l[4] ? n.removeAttribute(l) : n.setAttribute(l, "popover" == l && 1 == u ? "" : u));
	}
}
function O$1(n) {
	return function(u) {
		if (this.l) {
			var t = this.l[u.type + n];
			if (null == u.t) u.t = c$1++;
			else if (u.t < t.u) return;
			return t(l$1.event ? l$1.event(u) : u);
		}
	};
}
function z$1(n, u, t, i, r, o, e, f, c, s) {
	var a, h, p, y, _, m, b, S, C, M, $, I, A, H, L, T = u.type;
	if (void 0 !== u.constructor) return null;
	128 & t.__u && (c = !!(32 & t.__u), o = [f = u.__e = t.__e]), (a = l$1.__b) && a(u);
	n: if ("function" == typeof T) try {
		if (S = u.props, C = T.prototype && T.prototype.render, M = (a = T.contextType) && i[a.__c], $ = a ? M ? M.props.value : a.__ : i, t.__c ? b = (h = u.__c = t.__c).__ = h.__E : (C ? u.__c = h = new T(S, $) : (u.__c = h = new x(S, $), h.constructor = T, h.render = G$1), M && M.sub(h), h.state || (h.state = {}), h.__n = i, p = h.__d = !0, h.__h = [], h._sb = []), C && null == h.__s && (h.__s = h.state), C && null != T.getDerivedStateFromProps && (h.__s == h.state && (h.__s = w$1({}, h.__s)), w$1(h.__s, T.getDerivedStateFromProps(S, h.__s))), y = h.props, _ = h.state, h.__v = u, p) C && null == T.getDerivedStateFromProps && null != h.componentWillMount && h.componentWillMount(), C && null != h.componentDidMount && h.__h.push(h.componentDidMount);
		else {
			if (C && null == T.getDerivedStateFromProps && S !== y && null != h.componentWillReceiveProps && h.componentWillReceiveProps(S, $), u.__v == t.__v || !h.__e && null != h.shouldComponentUpdate && !1 === h.shouldComponentUpdate(S, h.__s, $)) {
				u.__v != t.__v && (h.props = S, h.state = h.__s, h.__d = !1), u.__e = t.__e, u.__k = t.__k, u.__k.some(function(n) {
					n && (n.__ = u);
				}), v$1.push.apply(h.__h, h._sb), h._sb = [], h.__h.length && e.push(h);
				break n;
			}
			null != h.componentWillUpdate && h.componentWillUpdate(S, h.__s, $), C && null != h.componentDidUpdate && h.__h.push(function() {
				h.componentDidUpdate(y, _, m);
			});
		}
		if (h.context = $, h.props = S, h.__P = n, h.__e = !1, I = l$1.__r, A = 0, C) h.state = h.__s, h.__d = !1, I && I(u), a = h.render(h.props, h.state, h.context), v$1.push.apply(h.__h, h._sb), h._sb = [];
		else do
			h.__d = !1, I && I(u), a = h.render(h.props, h.state, h.context), h.state = h.__s;
		while (h.__d && ++A < 25);
		h.state = h.__s, null != h.getChildContext && (i = w$1(w$1({}, i), h.getChildContext())), C && !p && null != h.getSnapshotBeforeUpdate && (m = h.getSnapshotBeforeUpdate(y, _)), H = null != a && a.type === k$1 && null == a.key ? q$2(a.props.children) : a, f = P$1(n, d$1(H) ? H : [H], u, t, i, r, o, e, f, c, s), h.base = u.__e, u.__u &= -161, h.__h.length && e.push(h), b && (h.__E = h.__ = null);
	} catch (n) {
		if (u.__v = null, c || null != o) if (n.then) {
			for (u.__u |= c ? 160 : 128; f && 8 == f.nodeType && f.nextSibling;) f = f.nextSibling;
			o[o.indexOf(f)] = null, u.__e = f;
		} else {
			for (L = o.length; L--;) g$1(o[L]);
			N(u);
		}
		else u.__e = t.__e, u.__k = t.__k, n.then || N(u);
		l$1.__e(n, u, t);
	}
	else null == o && u.__v == t.__v ? (u.__k = t.__k, u.__e = t.__e) : f = u.__e = B$2(t.__e, u, t, i, r, o, e, c, s);
	return (a = l$1.diffed) && a(u), 128 & u.__u ? void 0 : f;
}
function N(n) {
	n && (n.__c && (n.__c.__e = !0), n.__k && n.__k.some(N));
}
function V$1(n, u, t) {
	for (var i = 0; i < t.length; i++) D$1(t[i], t[++i], t[++i]);
	l$1.__c && l$1.__c(u, n), n.some(function(u) {
		try {
			n = u.__h, u.__h = [], n.some(function(n) {
				n.call(u);
			});
		} catch (n) {
			l$1.__e(n, u.__v);
		}
	});
}
function q$2(n) {
	return "object" != typeof n || null == n || n.__b > 0 ? n : d$1(n) ? n.map(q$2) : w$1({}, n);
}
function B$2(u, t, i, r, o, e, f, c, s) {
	var a, h, v, y, w, _, m, b = i.props || p$1, k = t.props, x = t.type;
	if ("svg" == x ? o = "http://www.w3.org/2000/svg" : "math" == x ? o = "http://www.w3.org/1998/Math/MathML" : o || (o = "http://www.w3.org/1999/xhtml"), null != e) {
		for (a = 0; a < e.length; a++) if ((w = e[a]) && "setAttribute" in w == !!x && (x ? w.localName == x : 3 == w.nodeType)) {
			u = w, e[a] = null;
			break;
		}
	}
	if (null == u) {
		if (null == x) return document.createTextNode(k);
		u = document.createElementNS(o, x, k.is && k), c && (l$1.__m && l$1.__m(t, e), c = !1), e = null;
	}
	if (null == x) b === k || c && u.data == k || (u.data = k);
	else {
		if (e = e && n.call(u.childNodes), !c && null != e) for (b = {}, a = 0; a < u.attributes.length; a++) b[(w = u.attributes[a]).name] = w.value;
		for (a in b) w = b[a], "dangerouslySetInnerHTML" == a ? v = w : "children" == a || a in k || "value" == a && "defaultValue" in k || "checked" == a && "defaultChecked" in k || F$1(u, a, null, w, o);
		for (a in k) w = k[a], "children" == a ? y = w : "dangerouslySetInnerHTML" == a ? h = w : "value" == a ? _ = w : "checked" == a ? m = w : c && "function" != typeof w || b[a] === w || F$1(u, a, w, b[a], o);
		if (h) c || v && (h.__html == v.__html || h.__html == u.innerHTML) || (u.innerHTML = h.__html), t.__k = [];
		else if (v && (u.innerHTML = ""), P$1("template" == t.type ? u.content : u, d$1(y) ? y : [y], t, i, r, "foreignObject" == x ? "http://www.w3.org/1999/xhtml" : o, e, f, e ? e[0] : i.__k && S(i, 0), c, s), null != e) for (a = e.length; a--;) g$1(e[a]);
		c || (a = "value", "progress" == x && null == _ ? u.removeAttribute("value") : null != _ && (_ !== u[a] || "progress" == x && !_ || "option" == x && _ != b[a]) && F$1(u, a, _, b[a], o), a = "checked", null != m && m != u[a] && F$1(u, a, m, b[a], o));
	}
	return u;
}
function D$1(n, u, t) {
	try {
		if ("function" == typeof n) {
			var i = "function" == typeof n.__u;
			i && n.__u(), i && null == u || (n.__u = n(u));
		} else n.current = u;
	} catch (n) {
		l$1.__e(n, t);
	}
}
function E$1(n, u, t) {
	var i, r;
	if (l$1.unmount && l$1.unmount(n), (i = n.ref) && (i.current && i.current != n.__e || D$1(i, null, u)), null != (i = n.__c)) {
		if (i.componentWillUnmount) try {
			i.componentWillUnmount();
		} catch (n) {
			l$1.__e(n, u);
		}
		i.base = i.__P = null;
	}
	if (i = n.__k) for (r = 0; r < i.length; r++) i[r] && E$1(i[r], u, t || "function" != typeof n.type);
	t || g$1(n.__e), n.__c = n.__ = n.__e = void 0;
}
function G$1(n, l, u) {
	return this.constructor(n, u);
}
function J$1(u, t, i) {
	var r, o, e, f;
	t == document && (t = document.documentElement), l$1.__ && l$1.__(u, t), o = (r = "function" == typeof i) ? null : i && i.__k || t.__k, e = [], f = [], z$1(t, u = (!r && i || t).__k = _$1(k$1, null, [u]), o || p$1, p$1, t.namespaceURI, !r && i ? [i] : o ? null : t.firstChild ? n.call(t.childNodes) : null, e, !r && i ? i : o ? o.__e : t.firstChild, r, f), V$1(e, u, f);
}
n = v$1.slice, l$1 = { __e: function(n, l, u, t) {
	for (var i, r, o; l = l.__;) if ((i = l.__c) && !i.__) try {
		if ((r = i.constructor) && null != r.getDerivedStateFromError && (i.setState(r.getDerivedStateFromError(n)), o = i.__d), null != i.componentDidCatch && (i.componentDidCatch(n, t || {}), o = i.__d), o) return i.__E = i;
	} catch (l) {
		n = l;
	}
	throw n;
} }, u$2 = 0, x.prototype.setState = function(n, l) {
	var u = null != this.__s && this.__s != this.state ? this.__s : this.__s = w$1({}, this.state);
	"function" == typeof n && (n = n(w$1({}, u), this.props)), n && w$1(u, n), null != n && this.__v && (l && this._sb.push(l), $$1(this));
}, x.prototype.forceUpdate = function(n) {
	this.__v && (this.__e = !0, n && this.__h.push(n), $$1(this));
}, x.prototype.render = k$1, i$2 = [], o$2 = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e$1 = function(n, l) {
	return n.__v.__b - l.__v.__b;
}, I.__r = 0, f$2 = /(PointerCapture)$|Capture$/i, c$1 = 0, s$1 = O$1(!1), a$1 = O$1(!0);
//#endregion
//#region src/styles.ts
const STYLES = `
:host {
  all: initial;
  font-family: system-ui, -apple-system, 'SF Pro Display', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ------------------------------------------------------------------ */
/* Variables                                                          */
/* ------------------------------------------------------------------ */

.up-root {
  --up-bg: #0A0A0A;
  --up-surface: #141414;
  --up-surface-hover: #1a1a1a;
  --up-surface-active: #1e1e1e;
  --up-border: #1e1e1e;
  --up-border-hover: #2a2a2a;
  --up-text-1: #ffffff;
  --up-text-2: #d4d4d4;
  --up-text-3: #a3a3a3;
  --up-text-4: #737373;
  --up-radius: 8px;
  --up-row-h: 36px;
  --up-transition: 0.15s ease;

  font-size: 13px;
  line-height: 1.4;
  color: var(--up-text-2);
}

/* ------------------------------------------------------------------ */
/* Shell                                                              */
/* ------------------------------------------------------------------ */

.up-shell {
  position: fixed;
  z-index: 2147483647;
  background: var(--up-bg);
  border: 1px solid var(--up-border);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 24px);
  transition: transform 0.25s cubic-bezier(0,0,0.2,1);
  user-select: none;
}

.up-shell-dragging {
  transition: none !important;
}

.up-content {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  padding: 0 12px 12px;
  scrollbar-width: none;
}

.up-content::-webkit-scrollbar { display: none; }

/* ------------------------------------------------------------------ */
/* Header                                                             */
/* ------------------------------------------------------------------ */

.up-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  cursor: grab;
  border-bottom: 1px solid var(--up-border);
  flex-shrink: 0;
}

.up-header:active { cursor: grabbing; }

.up-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.up-header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--up-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.up-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.up-header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--up-text-4);
  cursor: pointer;
  transition: color var(--up-transition), background var(--up-transition);
}

.up-header-btn:hover {
  color: var(--up-text-2);
  background: var(--up-surface);
}

.up-header-btn svg {
  width: 14px;
  height: 14px;
}

/* ------------------------------------------------------------------ */
/* Tabs                                                               */
/* ------------------------------------------------------------------ */

.up-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--up-border);
  flex-shrink: 0;
}

.up-tab {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--up-text-4);
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: color var(--up-transition), background var(--up-transition);
}

.up-tab:hover { color: var(--up-text-3); background: var(--up-surface); }
.up-tab-active { color: var(--up-text-2); background: var(--up-surface-active); }

/* ------------------------------------------------------------------ */
/* Collapsed tab                                                      */
/* ------------------------------------------------------------------ */

.up-collapsed {
  position: fixed;
  z-index: 2147483647;
  width: 36px;
  height: 36px;
  background: var(--up-bg);
  border: 1px solid var(--up-border);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transition: transform 0.25s cubic-bezier(0,0,0.2,1), opacity 0.15s;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  color: var(--up-text-3);
}

.up-collapsed:hover { background: var(--up-surface); color: var(--up-text-1); }
.up-collapsed:active { cursor: grabbing; }

.up-collapsed svg {
  width: 16px;
  height: 16px;
}

/* ------------------------------------------------------------------ */
/* Resize handles                                                     */
/* ------------------------------------------------------------------ */

.up-resize {
  position: absolute;
  z-index: 10;
}

.up-resize-top    { top: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
.up-resize-bottom { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
.up-resize-left   { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
.up-resize-right  { right: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }

.up-resize-top-left     { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
.up-resize-top-right    { top: -3px; right: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
.up-resize-bottom-left  { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
.up-resize-bottom-right { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: nwse-resize; }

/* ------------------------------------------------------------------ */
/* Folder                                                             */
/* ------------------------------------------------------------------ */

.up-folder {
  margin-bottom: 2px;
}

.up-folder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--up-row-h);
  cursor: pointer;
  user-select: none;
}

.up-folder-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--up-text-3);
}

.up-folder-chevron {
  width: 16px;
  height: 16px;
  color: var(--up-text-4);
  transition: transform 0.2s cubic-bezier(0,0,0.2,1);
  flex-shrink: 0;
}

.up-folder-chevron-open { transform: rotate(0deg); }
.up-folder-chevron-closed { transform: rotate(-90deg); }

.up-folder-content {
  overflow: hidden;
  transition: height 0.25s cubic-bezier(0,0,0.2,1);
}

.up-folder-inner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 4px;
}

/* ------------------------------------------------------------------ */
/* Slider                                                             */
/* ------------------------------------------------------------------ */

.up-slider-wrap { position: relative; height: var(--up-row-h); }

.up-slider {
  position: absolute;
  inset: 0;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  background: var(--up-surface);
  border-radius: var(--up-radius);
  touch-action: none;
}

.up-slider-hashmarks {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.up-slider-hashmark {
  position: absolute;
  top: 50%;
  width: 1px;
  height: 8px;
  border-radius: 999px;
  transform: translateX(-50%) translateY(-50%);
  background: transparent;
  transition: background 0.2s;
}

.up-slider-active .up-slider-hashmark {
  background: rgba(255,255,255,0.15);
}

.up-slider-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  transition: background 0.15s;
}

.up-slider-handle {
  position: absolute;
  top: 50%;
  width: 3px;
  height: 20px;
  border-radius: 999px;
  background: rgba(255,255,255,0.9);
  pointer-events: none;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.15s;
}

.up-slider-active .up-slider-handle { opacity: 0.5; }
.up-slider-dragging .up-slider-handle { opacity: 0.9; }

.up-slider-label {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  pointer-events: none;
}

.up-slider-value {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  font-weight: 500;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: var(--up-text-3);
  pointer-events: auto;
  border-bottom: 1px solid transparent;
  padding-bottom: 1px;
  transition: color 0.15s;
}

.up-slider-active .up-slider-value { color: var(--up-text-1); }

.up-slider-value-editable {
  border-bottom-color: var(--up-text-4);
  cursor: text;
}

.up-slider-input {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 5ch;
  font-size: 13px;
  font-weight: 500;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: var(--up-text-1);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--up-text-3);
  padding: 0 0 1px;
  outline: none;
  text-align: right;
}

/* ------------------------------------------------------------------ */
/* Toggle (segmented)                                                 */
/* ------------------------------------------------------------------ */

.up-labeled-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: var(--up-row-h);
  padding: 2px 10px 2px 12px;
  background: var(--up-surface);
  border-radius: var(--up-radius);
}

.up-labeled-row-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  flex-shrink: 0;
}

.up-seg {
  position: relative;
  display: flex;
  padding: 2px;
  border-radius: var(--up-radius);
  flex-shrink: 0;
}

.up-seg-pill {
  position: absolute;
  top: 2px;
  bottom: 2px;
  background: var(--up-surface-active);
  border-radius: 6px;
  z-index: 0;
  pointer-events: none;
  transition: left 0.2s cubic-bezier(0,0,0.2,1), width 0.2s cubic-bezier(0,0,0.2,1);
}

.up-seg-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 6px 12px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
  color: var(--up-text-4);
}

.up-seg-btn-active { color: var(--up-text-2); }

/* ------------------------------------------------------------------ */
/* Action button                                                      */
/* ------------------------------------------------------------------ */

.up-action {
  width: 100%;
  padding: 10px 16px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  background: var(--up-surface);
  border: none;
  border-radius: var(--up-radius);
  cursor: pointer;
  transition: background var(--up-transition), color var(--up-transition);
}

.up-action:hover { background: var(--up-surface-hover); color: var(--up-text-2); }
.up-action:active { background: var(--up-surface-active); }

/* ------------------------------------------------------------------ */
/* Select                                                             */
/* ------------------------------------------------------------------ */

.up-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: var(--up-row-h);
  padding: 0 12px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  background: var(--up-surface);
  border: none;
  border-radius: var(--up-radius);
  cursor: pointer;
  transition: background var(--up-transition);
}

.up-select-trigger:hover { background: var(--up-surface-hover); }
.up-select-trigger-open { background: var(--up-surface-active); }

.up-select-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.up-select-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
}

.up-select-chevron {
  width: 16px;
  height: 16px;
  color: var(--up-text-4);
  transition: transform 0.2s cubic-bezier(0,0,0.2,1);
  flex-shrink: 0;
}

.up-select-chevron-open { transform: rotate(180deg); }

.up-select-dropdown {
  position: absolute;
  background: #1a1a1a;
  border: 1px solid var(--up-border-hover);
  border-radius: var(--up-radius);
  padding: 4px;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  animation: up-dropdown-in 0.15s cubic-bezier(0,0,0.2,1);
}

@keyframes up-dropdown-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.up-select-option {
  display: block;
  width: 100%;
  padding: 8px 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: background var(--up-transition);
}

.up-select-option:hover { background: var(--up-surface-hover); }
.up-select-option-selected { color: var(--up-text-1); background: var(--up-surface-active); }

/* ------------------------------------------------------------------ */
/* Text input                                                         */
/* ------------------------------------------------------------------ */

.up-text-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: var(--up-row-h);
  padding: 0 12px;
  background: var(--up-surface);
  border-radius: var(--up-radius);
}

.up-text-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  flex-shrink: 0;
}

.up-text-input {
  flex: 1;
  min-width: 0;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  background: transparent;
  border: none;
  padding: 0;
  outline: none;
  text-align: right;
}

.up-text-input:focus { color: var(--up-text-1); }
.up-text-input::placeholder { color: var(--up-text-4); }

/* ------------------------------------------------------------------ */
/* Color                                                              */
/* ------------------------------------------------------------------ */

.up-color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: var(--up-row-h);
  padding: 0 12px;
  background: var(--up-surface);
  border-radius: var(--up-radius);
}

.up-color-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--up-text-3);
  flex-shrink: 0;
}

.up-color-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.up-color-hex {
  font-size: 13px;
  font-weight: 500;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: var(--up-text-3);
  cursor: text;
}

.up-color-hex-input {
  width: 7ch;
  font-size: 13px;
  font-weight: 500;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: var(--up-text-3);
  background: transparent;
  border: none;
  padding: 0;
  outline: none;
  text-transform: uppercase;
}

.up-color-hex-input:focus { color: var(--up-text-1); }

.up-color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--up-border-hover);
  cursor: pointer;
  transition: transform 0.15s;
  flex-shrink: 0;
}

.up-color-swatch:hover { transform: scale(1.1); }

.up-color-native {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

/* ------------------------------------------------------------------ */
/* Spring/Easing visualization                                        */
/* ------------------------------------------------------------------ */

.up-viz {
  width: 100%;
  border-radius: var(--up-radius);
  background: var(--up-surface);
  overflow: visible;
}

/* ------------------------------------------------------------------ */
/* Preset manager                                                     */
/* ------------------------------------------------------------------ */

.up-preset-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--up-border);
  flex-shrink: 0;
}

.up-preset-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  height: 28px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--up-text-3);
  background: var(--up-surface);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--up-transition);
}

.up-preset-trigger:hover { background: var(--up-surface-hover); }

.up-preset-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--up-surface);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--up-text-4);
  flex-shrink: 0;
  transition: background var(--up-transition), color var(--up-transition);
}

.up-preset-add:hover { background: var(--up-surface-hover); color: var(--up-text-2); }

.up-preset-add svg {
  width: 14px;
  height: 14px;
}

.up-preset-dropdown {
  position: absolute;
  background: #1a1a1a;
  border: 1px solid var(--up-border-hover);
  border-radius: 10px;
  padding: 4px;
  z-index: 20;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  min-width: 140px;
  animation: up-dropdown-in 0.15s cubic-bezier(0,0,0.2,1);
}

.up-preset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  gap: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--up-transition);
  font-size: 12px;
  font-weight: 500;
  color: var(--up-text-3);
}

.up-preset-item:hover { background: var(--up-surface-hover); }
.up-preset-item-active { color: var(--up-text-1); background: var(--up-surface-active); }

.up-preset-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0;
  color: var(--up-text-4);
  flex-shrink: 0;
  transition: opacity var(--up-transition);
}

.up-preset-item:hover .up-preset-delete { opacity: 0.6; }
.up-preset-delete:hover { opacity: 1 !important; }

.up-preset-delete svg {
  width: 12px;
  height: 12px;
}

/* ------------------------------------------------------------------ */
/* Copy button                                                        */
/* ------------------------------------------------------------------ */

.up-copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--up-surface);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--up-text-4);
  flex-shrink: 0;
  transition: background var(--up-transition), color var(--up-transition);
}

.up-copy-btn:hover { background: var(--up-surface-hover); color: var(--up-text-2); }

.up-copy-btn svg {
  width: 14px;
  height: 14px;
}

/* ------------------------------------------------------------------ */
/* Slot                                                               */
/* ------------------------------------------------------------------ */

.up-slot-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.up-slot-wrap-empty {
  display: none;
}

.up-slot {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.up-slot-label {
  font-size: 11px;
  color: var(--up-text-3);
  padding: 0 2px;
}

/* ------------------------------------------------------------------ */
/* Panel section                                                      */
/* ------------------------------------------------------------------ */

.up-panel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ------------------------------------------------------------------ */
/* Children slot                                                      */
/* ------------------------------------------------------------------ */

.up-children {
  padding: 0 0 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--up-border);
}

.up-children:empty {
  display: none;
}

/* ------------------------------------------------------------------ */
/* Portal container (for dropdowns inside shadow DOM)                  */
/* ------------------------------------------------------------------ */

.up-portal {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147483647;
  pointer-events: none;
}

.up-portal > * {
  pointer-events: auto;
}
`;
//#endregion
//#region node_modules/.pnpm/preact@10.29.0/node_modules/preact/hooks/dist/hooks.mjs
var t, r, u$1, i$1, o$1 = 0, f$1 = [], c = l$1, e = c.__b, a = c.__r, v = c.diffed, l = c.__c, m = c.unmount, s = c.__;
function p(n, t) {
	c.__h && c.__h(r, n, o$1 || t), o$1 = 0;
	var u = r.__H || (r.__H = {
		__: [],
		__h: []
	});
	return n >= u.__.length && u.__.push({}), u.__[n];
}
function d(n) {
	return o$1 = 1, h(D, n);
}
function h(n, u, i) {
	var o = p(t++, 2);
	if (o.t = n, !o.__c && (o.__ = [i ? i(u) : D(void 0, u), function(n) {
		var t = o.__N ? o.__N[0] : o.__[0], r = o.t(t, n);
		t !== r && (o.__N = [r, o.__[1]], o.__c.setState({}));
	}], o.__c = r, !r.__f)) {
		var f = function(n, t, r) {
			if (!o.__c.__H) return !0;
			var u = o.__c.__H.__.filter(function(n) {
				return n.__c;
			});
			if (u.every(function(n) {
				return !n.__N;
			})) return !c || c.call(this, n, t, r);
			var i = o.__c.props !== n;
			return u.some(function(n) {
				if (n.__N) {
					var t = n.__[0];
					n.__ = n.__N, n.__N = void 0, t !== n.__[0] && (i = !0);
				}
			}), c && c.call(this, n, t, r) || i;
		};
		r.__f = !0;
		var c = r.shouldComponentUpdate, e = r.componentWillUpdate;
		r.componentWillUpdate = function(n, t, r) {
			if (this.__e) {
				var u = c;
				c = void 0, f(n, t, r), c = u;
			}
			e && e.call(this, n, t, r);
		}, r.shouldComponentUpdate = f;
	}
	return o.__N || o.__;
}
function y(n, u) {
	var i = p(t++, 3);
	!c.__s && C(i.__H, u) && (i.__ = n, i.u = u, r.__H.__h.push(i));
}
function _(n, u) {
	var i = p(t++, 4);
	!c.__s && C(i.__H, u) && (i.__ = n, i.u = u, r.__h.push(i));
}
function A$1(n) {
	return o$1 = 5, T$1(function() {
		return { current: n };
	}, []);
}
function T$1(n, r) {
	var u = p(t++, 7);
	return C(u.__H, r) && (u.__ = n(), u.__H = r, u.__h = n), u.__;
}
function q$1(n, t) {
	return o$1 = 8, T$1(function() {
		return n;
	}, t);
}
function j$1() {
	for (var n; n = f$1.shift();) {
		var t = n.__H;
		if (n.__P && t) try {
			t.__h.some(z), t.__h.some(B$1), t.__h = [];
		} catch (r) {
			t.__h = [], c.__e(r, n.__v);
		}
	}
}
c.__b = function(n) {
	r = null, e && e(n);
}, c.__ = function(n, t) {
	n && t.__k && t.__k.__m && (n.__m = t.__k.__m), s && s(n, t);
}, c.__r = function(n) {
	a && a(n), t = 0;
	var i = (r = n.__c).__H;
	i && (u$1 === r ? (i.__h = [], r.__h = [], i.__.some(function(n) {
		n.__N && (n.__ = n.__N), n.u = n.__N = void 0;
	})) : (i.__h.some(z), i.__h.some(B$1), i.__h = [], t = 0)), u$1 = r;
}, c.diffed = function(n) {
	v && v(n);
	var t = n.__c;
	t && t.__H && (t.__H.__h.length && (1 !== f$1.push(t) && i$1 === c.requestAnimationFrame || ((i$1 = c.requestAnimationFrame) || w)(j$1)), t.__H.__.some(function(n) {
		n.u && (n.__H = n.u), n.u = void 0;
	})), u$1 = r = null;
}, c.__c = function(n, t) {
	t.some(function(n) {
		try {
			n.__h.some(z), n.__h = n.__h.filter(function(n) {
				return !n.__ || B$1(n);
			});
		} catch (r) {
			t.some(function(n) {
				n.__h && (n.__h = []);
			}), t = [], c.__e(r, n.__v);
		}
	}), l && l(n, t);
}, c.unmount = function(n) {
	m && m(n);
	var t, r = n.__c;
	r && r.__H && (r.__H.__.some(function(n) {
		try {
			z(n);
		} catch (n) {
			t = n;
		}
	}), r.__H = void 0, t && c.__e(t, r.__v));
};
var k = "function" == typeof requestAnimationFrame;
function w(n) {
	var t, r = function() {
		clearTimeout(u), k && cancelAnimationFrame(t), setTimeout(n);
	}, u = setTimeout(r, 35);
	k && (t = requestAnimationFrame(r));
}
function z(n) {
	var t = r, u = n.__c;
	"function" == typeof u && (n.__c = void 0, u()), r = t;
}
function B$1(n) {
	var t = r;
	n.__c = n.__(), r = t;
}
function C(n, t) {
	return !n || n.length !== t.length || t.some(function(t, r) {
		return t !== n[r];
	});
}
function D(n, t) {
	return "function" == typeof t ? t(n) : t;
}
function calculatePosition(corner, width, height) {
	const ww = window.innerWidth;
	const wh = window.innerHeight;
	const right = ww - width - 12;
	const bottom = wh - height - 12;
	switch (corner) {
		case "top-left": return {
			x: 12,
			y: 12
		};
		case "top-right": return {
			x: right,
			y: 12
		};
		case "bottom-left": return {
			x: 12,
			y: bottom
		};
		case "bottom-right": return {
			x: right,
			y: bottom
		};
	}
}
function getBestCorner(mouseX, mouseY, initialMouseX, initialMouseY, threshold = 60) {
	const dx = mouseX - initialMouseX;
	const dy = mouseY - initialMouseY;
	const cx = window.innerWidth / 2;
	const cy = window.innerHeight / 2;
	const movingRight = dx > threshold;
	const movingLeft = dx < -threshold;
	const movingDown = dy > threshold;
	const movingUp = dy < -threshold;
	if (movingRight || movingLeft) {
		const isBottom = mouseY > cy;
		return movingRight ? isBottom ? "bottom-right" : "top-right" : isBottom ? "bottom-left" : "top-left";
	}
	if (movingDown || movingUp) {
		const isRight = mouseX > cx;
		return movingDown ? isRight ? "bottom-right" : "bottom-left" : isRight ? "top-right" : "top-left";
	}
	return mouseX > cx ? mouseY > cy ? "bottom-right" : "top-right" : mouseY > cy ? "bottom-left" : "top-left";
}
function getCollapsedPosition(corner, orientation) {
	const ww = window.innerWidth;
	const wh = window.innerHeight;
	const half = 36 / 2;
	if (orientation === "horizontal") {
		const y = corner.startsWith("top") ? 72 : wh - 12 - 36 - 60;
		return corner.endsWith("left") ? {
			x: -half,
			y
		} : {
			x: ww - half,
			y
		};
	}
	const x = corner.endsWith("left") ? 72 : ww - 12 - 36 - 60;
	return corner.startsWith("top") ? {
		x,
		y: -half
	} : {
		x,
		y: wh - half
	};
}
function calculateResizedSizeAndPosition(handle, initialWidth, initialHeight, initialX, initialY, deltaX, deltaY) {
	const maxW = window.innerWidth - 24;
	const maxH = window.innerHeight - 24;
	let w = initialWidth;
	let h = initialHeight;
	let x = initialX;
	let y = initialY;
	if (handle.includes("right")) {
		const avail = window.innerWidth - initialX - 12;
		w = Math.min(maxW, Math.max(280, Math.min(initialWidth + deltaX, avail)));
	}
	if (handle.includes("left")) {
		const avail = initialX + initialWidth - 12;
		const proposed = Math.min(maxW, Math.max(280, Math.min(initialWidth - deltaX, avail)));
		x = initialX - (proposed - initialWidth);
		w = proposed;
	}
	if (handle.includes("bottom")) {
		const avail = window.innerHeight - initialY - 12;
		h = Math.min(maxH, Math.max(200, Math.min(initialHeight + deltaY, avail)));
	}
	if (handle.includes("top")) {
		const avail = initialY + initialHeight - 12;
		const proposed = Math.min(maxH, Math.max(200, Math.min(initialHeight - deltaY, avail)));
		y = initialY - (proposed - initialHeight);
		h = proposed;
	}
	return {
		width: w,
		height: h,
		x,
		y
	};
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.0/node_modules/preact/jsx-runtime/dist/jsxRuntime.mjs
var f = 0;
Array.isArray;
function u(e, t, n, o, i, u) {
	t || (t = {});
	var a, c, p = t;
	if ("ref" in p) for (c in p = {}, t) "ref" == c ? a = t[c] : p[c] = t[c];
	var l = {
		type: e,
		props: p,
		key: n,
		ref: a,
		__k: null,
		__: null,
		__b: 0,
		__e: null,
		__c: null,
		constructor: void 0,
		__v: --f,
		__i: -1,
		__u: 0,
		__source: i,
		__self: u
	};
	if ("function" == typeof e && (a = e.defaultProps)) for (c in a) void 0 === p[c] && (p[c] = a[c]);
	return l$1.vnode && l$1.vnode(l), l;
}
//#endregion
//#region src/ui/Controls.tsx
function Toggle({ label, checked, onChange }) {
	return /* @__PURE__ */ u("div", {
		class: "up-labeled-row",
		children: [/* @__PURE__ */ u("span", {
			class: "up-labeled-row-label",
			children: label
		}), /* @__PURE__ */ u(SegmentedControl, {
			options: [{
				value: "off",
				label: "Off"
			}, {
				value: "on",
				label: "On"
			}],
			value: checked ? "on" : "off",
			onChange: (v) => onChange(v === "on")
		})]
	});
}
function SegmentedControl({ options, value, onChange }) {
	const containerRef = A$1(null);
	const btnRefs = A$1(/* @__PURE__ */ new Map());
	const [pillStyle, setPillStyle] = d(null);
	_(() => {
		const btn = btnRefs.current.get(value);
		const container = containerRef.current;
		if (btn && container) {
			const cr = container.getBoundingClientRect();
			const br = btn.getBoundingClientRect();
			setPillStyle({
				left: br.left - cr.left,
				width: br.width
			});
		}
	}, [value]);
	return /* @__PURE__ */ u("div", {
		ref: containerRef,
		class: "up-seg",
		children: [pillStyle && /* @__PURE__ */ u("div", {
			class: "up-seg-pill",
			style: {
				left: `${pillStyle.left}px`,
				width: `${pillStyle.width}px`
			}
		}), options.map((opt) => /* @__PURE__ */ u("button", {
			ref: (el) => {
				if (el) btnRefs.current.set(opt.value, el);
			},
			class: `up-seg-btn ${value === opt.value ? "up-seg-btn-active" : ""}`,
			onClick: () => onChange(opt.value),
			children: opt.label
		}, opt.value))]
	});
}
function Action({ label, onClick }) {
	return /* @__PURE__ */ u("button", {
		class: "up-action",
		onClick,
		children: label
	});
}
function TextInput({ label, value, onChange, placeholder }) {
	return /* @__PURE__ */ u("div", {
		class: "up-text-row",
		children: [/* @__PURE__ */ u("span", {
			class: "up-text-label",
			children: label
		}), /* @__PURE__ */ u("input", {
			type: "text",
			class: "up-text-input",
			value,
			onInput: (e) => onChange(e.target.value),
			placeholder,
			spellcheck: false
		})]
	});
}
const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
function ColorPicker({ label, value, onChange }) {
	const nativeRef = A$1(null);
	const [editing, setEditing] = d(false);
	const [draft, setDraft] = d(value);
	y(() => {
		if (!editing) setDraft(value);
	}, [value, editing]);
	const submit = q$1(() => {
		setEditing(false);
		if (HEX_RE.test(draft)) onChange(draft);
		else setDraft(value);
	}, [
		draft,
		onChange,
		value
	]);
	const expandHex = (hex) => hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
	return /* @__PURE__ */ u("div", {
		class: "up-color-row",
		children: [/* @__PURE__ */ u("span", {
			class: "up-color-label",
			children: label
		}), /* @__PURE__ */ u("div", {
			class: "up-color-inputs",
			children: [
				editing ? /* @__PURE__ */ u("input", {
					type: "text",
					class: "up-color-hex-input",
					value: draft,
					onInput: (e) => setDraft(e.target.value),
					onBlur: submit,
					onKeyDown: (e) => {
						if (e.key === "Enter") submit();
						if (e.key === "Escape") {
							setEditing(false);
							setDraft(value);
						}
					},
					autoFocus: true
				}) : /* @__PURE__ */ u("span", {
					class: "up-color-hex",
					onClick: () => setEditing(true),
					children: (value ?? "").toUpperCase()
				}),
				/* @__PURE__ */ u("button", {
					class: "up-color-swatch",
					style: { backgroundColor: value },
					onClick: () => nativeRef.current?.click(),
					title: "Pick color"
				}),
				/* @__PURE__ */ u("input", {
					ref: nativeRef,
					type: "color",
					class: "up-color-native",
					value: expandHex(value).slice(0, 7),
					onInput: (e) => onChange(e.target.value)
				})
			]
		})]
	});
}
//#endregion
//#region src/ui/Folder.tsx
function Folder({ title, defaultOpen = true, children }) {
	const [isOpen, setIsOpen] = d(defaultOpen);
	const contentRef = A$1(null);
	const innerRef = A$1(null);
	const [height, setHeight] = d(null);
	const measure = q$1(() => {
		if (innerRef.current) setHeight(innerRef.current.offsetHeight);
	}, []);
	y(() => {
		measure();
		const ro = new ResizeObserver(measure);
		if (innerRef.current) ro.observe(innerRef.current);
		return () => ro.disconnect();
	}, [measure]);
	return /* @__PURE__ */ u("div", {
		class: "up-folder",
		children: [/* @__PURE__ */ u("div", {
			class: "up-folder-header",
			onClick: q$1(() => {
				if (!isOpen) measure();
				setIsOpen((prev) => !prev);
			}, [isOpen, measure]),
			children: [/* @__PURE__ */ u("span", {
				class: "up-folder-title",
				children: title
			}), /* @__PURE__ */ u("svg", {
				class: `up-folder-chevron ${isOpen ? "up-folder-chevron-open" : "up-folder-chevron-closed"}`,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				"stroke-width": "2.5",
				"stroke-linecap": "round",
				"stroke-linejoin": "round",
				children: /* @__PURE__ */ u("path", { d: "M6 9.5L12 15.5L18 9.5" })
			})]
		}), /* @__PURE__ */ u("div", {
			ref: contentRef,
			class: "up-folder-content",
			style: { height: isOpen ? height !== null ? `${height}px` : "auto" : "0px" },
			children: /* @__PURE__ */ u("div", {
				ref: innerRef,
				class: "up-folder-inner",
				children
			})
		})]
	});
}
//#endregion
//#region node_modules/.pnpm/preact@10.29.0/node_modules/preact/compat/dist/compat.mjs
function g(n, t) {
	for (var e in t) n[e] = t[e];
	return n;
}
function E(n, t) {
	for (var e in n) if ("__source" !== e && !(e in t)) return !0;
	for (var r in t) if ("__source" !== r && n[r] !== t[r]) return !0;
	return !1;
}
function M(n, t) {
	this.props = n, this.context = t;
}
(M.prototype = new x()).isPureReactComponent = !0, M.prototype.shouldComponentUpdate = function(n, t) {
	return E(this.props, n) || E(this.state, t);
};
var T = l$1.__b;
l$1.__b = function(n) {
	n.type && n.type.__f && n.ref && (n.props.ref = n.ref, n.ref = null), T && T(n);
};
"undefined" != typeof Symbol && Symbol.for;
var O = l$1.__e;
l$1.__e = function(n, t, e, r) {
	if (n.then) {
		for (var u, o = t; o = o.__;) if ((u = o.__c) && u.__c) return t.__e ?? (t.__e = e.__e, t.__k = e.__k), u.__c(n, t);
	}
	O(n, t, e, r);
};
var U = l$1.unmount;
function V(n, t, e) {
	return n && (n.__c && n.__c.__H && (n.__c.__H.__.forEach(function(n) {
		"function" == typeof n.__c && n.__c();
	}), n.__c.__H = null), null != (n = g({}, n)).__c && (n.__c.__P === e && (n.__c.__P = t), n.__c.__e = !0, n.__c = null), n.__k = n.__k && n.__k.map(function(n) {
		return V(n, t, e);
	})), n;
}
function W(n, t, e) {
	return n && e && (n.__v = null, n.__k = n.__k && n.__k.map(function(n) {
		return W(n, t, e);
	}), n.__c && n.__c.__P === t && (n.__e && e.appendChild(n.__e), n.__c.__e = !0, n.__c.__P = e)), n;
}
function P() {
	this.__u = 0, this.o = null, this.__b = null;
}
function j(n) {
	var t = n.__ && n.__.__c;
	return t && t.__a && t.__a(n);
}
function B() {
	this.i = null, this.l = null;
}
l$1.unmount = function(n) {
	var t = n.__c;
	t && (t.__z = !0), t && t.__R && t.__R(), t && 32 & n.__u && (n.type = null), U && U(n);
}, (P.prototype = new x()).__c = function(n, t) {
	var e = t.__c, r = this;
	r.o ??= [], r.o.push(e);
	var u = j(r.__v), o = !1, i = function() {
		o || r.__z || (o = !0, e.__R = null, u ? u(c) : c());
	};
	e.__R = i;
	var l = e.__P;
	e.__P = null;
	var c = function() {
		if (!--r.__u) {
			if (r.state.__a) {
				var n = r.state.__a;
				r.__v.__k[0] = W(n, n.__c.__P, n.__c.__O);
			}
			var t;
			for (r.setState({ __a: r.__b = null }); t = r.o.pop();) t.__P = l, t.forceUpdate();
		}
	};
	r.__u++ || 32 & t.__u || r.setState({ __a: r.__b = r.__v.__k[0] }), n.then(i, i);
}, P.prototype.componentWillUnmount = function() {
	this.o = [];
}, P.prototype.render = function(n, e) {
	if (this.__b) {
		if (this.__v.__k) {
			var r = document.createElement("div"), o = this.__v.__k[0].__c;
			this.__v.__k[0] = V(this.__b, r, o.__O = o.__P);
		}
		this.__b = null;
	}
	var i = e.__a && _$1(k$1, null, n.fallback);
	return i && (i.__u &= -33), [_$1(k$1, null, e.__a ? null : n.children), i];
};
var H = function(n, t, e) {
	if (++e[1] === e[0] && n.l.delete(t), n.props.revealOrder && ("t" !== n.props.revealOrder[0] || !n.l.size)) for (e = n.i; e;) {
		for (; e.length > 3;) e.pop()();
		if (e[1] < e[0]) break;
		n.i = e = e[2];
	}
};
function Z(n) {
	return this.getChildContext = function() {
		return n.context;
	}, n.children;
}
function Y(n) {
	var e = this, r = n.h;
	if (e.componentWillUnmount = function() {
		J$1(null, e.v), e.v = null, e.h = null;
	}, e.h && e.h !== r && e.componentWillUnmount(), !e.v) {
		for (var u = e.__v; null !== u && !u.__m && null !== u.__;) u = u.__;
		e.h = r, e.v = {
			nodeType: 1,
			parentNode: r,
			childNodes: [],
			__k: { __m: u.__m },
			contains: function() {
				return !0;
			},
			namespaceURI: r.namespaceURI,
			insertBefore: function(n, t) {
				this.childNodes.push(n), e.h.insertBefore(n, t);
			},
			removeChild: function(n) {
				this.childNodes.splice(this.childNodes.indexOf(n) >>> 1, 1), e.h.removeChild(n);
			}
		};
	}
	J$1(_$1(Z, { context: e.context }, n.__v), e.v);
}
function $(n, e) {
	var r = _$1(Y, {
		__v: n,
		h: e
	});
	return r.containerInfo = e, r;
}
(B.prototype = new x()).__a = function(n) {
	var t = this, e = j(t.__v), r = t.l.get(n);
	return r[0]++, function(u) {
		var o = function() {
			t.props.revealOrder ? (r.push(u), H(t, n, r)) : u();
		};
		e ? e(o) : o();
	};
}, B.prototype.render = function(n) {
	this.i = null, this.l = /* @__PURE__ */ new Map();
	var t = L$1(n.children);
	n.revealOrder && "b" === n.revealOrder[0] && t.reverse();
	for (var e = t.length; e--;) this.l.set(t[e], this.i = [
		1,
		0,
		this.i
	]);
	return n.children;
}, B.prototype.componentDidUpdate = B.prototype.componentDidMount = function() {
	var n = this;
	this.l.forEach(function(t, e) {
		H(n, e, t);
	});
};
var q = "undefined" != typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103, G = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/, J = /^on(Ani|Tra|Tou|BeforeInp|Compo)/, K = /[A-Z0-9]/g, Q = "undefined" != typeof document, X = function(n) {
	return ("undefined" != typeof Symbol && "symbol" == typeof Symbol() ? /fil|che|rad/ : /fil|che|ra/).test(n);
};
x.prototype.isReactComponent = !0, [
	"componentWillMount",
	"componentWillReceiveProps",
	"componentWillUpdate"
].forEach(function(t) {
	Object.defineProperty(x.prototype, t, {
		configurable: !0,
		get: function() {
			return this["UNSAFE_" + t];
		},
		set: function(n) {
			Object.defineProperty(this, t, {
				configurable: !0,
				writable: !0,
				value: n
			});
		}
	});
});
var en = l$1.event;
l$1.event = function(n) {
	return en && (n = en(n)), n.persist = function() {}, n.isPropagationStopped = function() {
		return this.cancelBubble;
	}, n.isDefaultPrevented = function() {
		return this.defaultPrevented;
	}, n.nativeEvent = n;
};
var un = {
	configurable: !0,
	get: function() {
		return this.class;
	}
}, on = l$1.vnode;
l$1.vnode = function(n) {
	"string" == typeof n.type && function(n) {
		var t = n.props, e = n.type, u = {}, o = -1 == e.indexOf("-");
		for (var i in t) {
			var l = t[i];
			if (!("value" === i && "defaultValue" in t && null == l || Q && "children" === i && "noscript" === e || "class" === i || "className" === i)) {
				var c = i.toLowerCase();
				"defaultValue" === i && "value" in t && null == t.value ? i = "value" : "download" === i && !0 === l ? l = "" : "translate" === c && "no" === l ? l = !1 : "o" === c[0] && "n" === c[1] ? "ondoubleclick" === c ? i = "ondblclick" : "onchange" !== c || "input" !== e && "textarea" !== e || X(t.type) ? "onfocus" === c ? i = "onfocusin" : "onblur" === c ? i = "onfocusout" : J.test(i) && (i = c) : c = i = "oninput" : o && G.test(i) ? i = i.replace(K, "-$&").toLowerCase() : null === l && (l = void 0), "oninput" === c && u[i = c] && (i = "oninputCapture"), u[i] = l;
			}
		}
		"select" == e && (u.multiple && Array.isArray(u.value) && (u.value = L$1(t.children).forEach(function(n) {
			n.props.selected = -1 != u.value.indexOf(n.props.value);
		})), null != u.defaultValue && (u.value = L$1(t.children).forEach(function(n) {
			n.props.selected = u.multiple ? -1 != u.defaultValue.indexOf(n.props.value) : u.defaultValue == n.props.value;
		}))), t.class && !t.className ? (u.class = t.class, Object.defineProperty(u, "className", un)) : t.className && (u.class = u.className = t.className), n.props = u;
	}(n), n.$$typeof = q, on && on(n);
};
var ln = l$1.__r;
l$1.__r = function(n) {
	ln && ln(n), n.__c;
};
var cn = l$1.diffed;
l$1.diffed = function(n) {
	cn && cn(n);
	var t = n.props, e = n.__e;
	null != e && "textarea" === n.type && "value" in t && t.value !== e.value && (e.value = null == t.value ? "" : t.value);
};
//#endregion
//#region src/ui/Select.tsx
function Select({ label, value, options, onChange, portalContainer }) {
	const [isOpen, setIsOpen] = d(false);
	const triggerRef = A$1(null);
	const dropdownRef = A$1(null);
	const [hoveredValue, setHoveredValue] = d(null);
	const [pos, setPos] = d(null);
	const normalized = normalizeSelectOptions(options);
	const selected = normalized.find((o) => o.value === value);
	const updatePos = q$1(() => {
		const el = triggerRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const ddHeight = 8 + normalized.length * 36;
		const above = window.innerHeight - rect.bottom - 4 < ddHeight && rect.top > ddHeight;
		setPos({
			top: above ? rect.top - 4 : rect.bottom + 4,
			left: rect.left,
			width: rect.width,
			above
		});
	}, [normalized.length]);
	y(() => {
		if (!isOpen) {
			setPos(null);
			return;
		}
		updatePos();
	}, [isOpen, updatePos]);
	const portalTarget = typeof document !== "undefined" ? document.body : portalContainer;
	return /* @__PURE__ */ u("div", { children: [/* @__PURE__ */ u("button", {
		type: "button",
		ref: triggerRef,
		class: `up-select-trigger ${isOpen ? "up-select-trigger-open" : ""}`,
		onMouseDown: (e) => {
			e.preventDefault();
			e.stopPropagation();
			setIsOpen((v) => !v);
		},
		onClick: (e) => {
			if (e.detail !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			setIsOpen((v) => !v);
		},
		children: [/* @__PURE__ */ u("span", { children: label }), /* @__PURE__ */ u("div", {
			class: "up-select-right",
			children: [/* @__PURE__ */ u("span", {
				class: "up-select-value",
				children: selected?.label ?? value
			}), /* @__PURE__ */ u("svg", {
				class: `up-select-chevron ${isOpen ? "up-select-chevron-open" : ""}`,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				"stroke-width": "2.5",
				"stroke-linecap": "round",
				"stroke-linejoin": "round",
				children: /* @__PURE__ */ u("path", { d: "M6 9.5L12 15.5L18 9.5" })
			})]
		})]
	}), isOpen && pos && portalTarget && $(/* @__PURE__ */ u(k$1, { children: [/* @__PURE__ */ u("div", {
		style: {
			position: "fixed",
			inset: 0,
			zIndex: 2147483646
		},
		onMouseDown: (e) => {
			e.preventDefault();
			e.stopPropagation();
			setIsOpen(false);
		}
	}), /* @__PURE__ */ u("div", {
		ref: dropdownRef,
		class: "up-select-dropdown",
		onMouseDown: (e) => e.stopPropagation(),
		style: {
			position: "fixed",
			zIndex: 2147483647,
			display: "flex",
			flexDirection: "column",
			gap: "0",
			padding: "4px",
			left: `${pos.left}px`,
			width: `${pos.width}px`,
			background: "#1a1a1a",
			border: "1px solid #2a2a2a",
			borderRadius: "8px",
			boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
			fontFamily: "system-ui, -apple-system, 'SF Pro Display', sans-serif",
			fontSize: "13px",
			...pos.above ? { bottom: `${window.innerHeight - pos.top}px` } : { top: `${pos.top}px` }
		},
		children: normalized.map((opt) => /* @__PURE__ */ u("button", {
			type: "button",
			class: `up-select-option ${opt.value === value ? "up-select-option-selected" : ""}`,
			onMouseEnter: () => setHoveredValue(opt.value),
			onMouseLeave: () => setHoveredValue((current) => current === opt.value ? null : current),
			onClick: () => {
				onChange(opt.value);
				setIsOpen(false);
			},
			style: {
				display: "block",
				width: "100%",
				padding: "8px 10px",
				fontFamily: "inherit",
				fontSize: "13px",
				fontWeight: "500",
				color: opt.value === value ? "#ffffff" : "#a3a3a3",
				background: opt.value === value ? "#1e1e1e" : hoveredValue === opt.value ? "#141414" : "transparent",
				border: "none",
				borderRadius: "6px",
				cursor: "pointer",
				textAlign: "left",
				appearance: "none"
			},
			children: opt.label
		}, opt.value))
	})] }), portalTarget)] });
}
//#endregion
//#region src/anim.ts
function animateSpring(from, to, config, onUpdate, onComplete) {
	const { stiffness = 300, damping = 25, mass = .8 } = config;
	let position = from;
	let velocity = 0;
	let rafId = null;
	let lastTime = null;
	let stopped = false;
	function tick(now) {
		if (stopped) return;
		if (lastTime === null) {
			lastTime = now;
			rafId = requestAnimationFrame(tick);
			return;
		}
		const dt = Math.min((now - lastTime) / 1e3, .032);
		lastTime = now;
		const accel = (-stiffness * (position - to) + -damping * velocity) / mass;
		velocity += accel * dt;
		position += velocity * dt;
		if (Math.abs(position - to) < .001 && Math.abs(velocity) < .01) {
			onUpdate(to);
			onComplete?.();
			return;
		}
		onUpdate(position);
		rafId = requestAnimationFrame(tick);
	}
	rafId = requestAnimationFrame(tick);
	return { stop() {
		stopped = true;
		if (rafId !== null) cancelAnimationFrame(rafId);
	} };
}
//#endregion
//#region src/ui/Slider.tsx
const CLICK_THRESHOLD = 3;
const DEAD_ZONE = 32;
const MAX_CURSOR_RANGE = 200;
const MAX_STRETCH = 8;
function decimalsForStep(step) {
	const s = step.toString();
	const dot = s.indexOf(".");
	return dot === -1 ? 0 : s.length - dot - 1;
}
function roundValue(val, step) {
	const raw = Math.round(val / step) * step;
	return parseFloat(raw.toFixed(decimalsForStep(step)));
}
function snapToDecile(rawValue, min, max) {
	const normalized = (rawValue - min) / (max - min);
	const nearest = Math.round(normalized * 10) / 10;
	if (Math.abs(normalized - nearest) <= .03125) return min + nearest * (max - min);
	return rawValue;
}
function Slider({ label, value, onChange, min, max, step }) {
	const wrapRef = A$1(null);
	const inputRef = A$1(null);
	const [isHovered, setIsHovered] = d(false);
	const [isDragging, setIsDragging] = d(false);
	const [isEditing, setIsEditing] = d(false);
	const [editValue, setEditValue] = d("");
	const [isValueEditable, setIsValueEditable] = d(false);
	const [isValueHovered, setIsValueHovered] = d(false);
	const interacting = A$1(false);
	const pointerStart = A$1(null);
	const isClick = A$1(true);
	const animHandle = A$1(null);
	const rectRef = A$1(null);
	const fillRef = A$1(null);
	const handleRef = A$1(null);
	const trackRef = A$1(null);
	const percentage = (value - min) / (max - min) * 100;
	y(() => {
		if (!interacting.current && !animHandle.current) {
			if (fillRef.current) fillRef.current.style.width = `${percentage}%`;
			if (handleRef.current) handleRef.current.style.left = `max(5px, calc(${percentage}% - 9px))`;
		}
	}, [percentage]);
	const setFillPercent = q$1((pct) => {
		if (fillRef.current) fillRef.current.style.width = `${pct}%`;
		if (handleRef.current) handleRef.current.style.left = `max(5px, calc(${pct}% - 9px))`;
	}, []);
	const positionToValue = q$1((clientX) => {
		const rect = rectRef.current;
		if (!rect) return value;
		const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		return Math.max(min, Math.min(max, min + pct * (max - min)));
	}, [
		min,
		max,
		value
	]);
	const computeStretch = q$1((clientX, sign) => {
		const rect = rectRef.current;
		if (!rect) return 0;
		const dist = sign < 0 ? rect.left - clientX : clientX - rect.right;
		const overflow = Math.max(0, dist - DEAD_ZONE);
		return sign * MAX_STRETCH * Math.sqrt(Math.min(overflow / MAX_CURSOR_RANGE, 1));
	}, []);
	const handlePointerDown = q$1((e) => {
		if (isEditing) return;
		e.preventDefault();
		e.target.setPointerCapture(e.pointerId);
		pointerStart.current = {
			x: e.clientX,
			y: e.clientY
		};
		isClick.current = true;
		interacting.current = true;
		if (wrapRef.current) rectRef.current = wrapRef.current.getBoundingClientRect();
	}, [isEditing]);
	const handlePointerMove = q$1((e) => {
		if (!interacting.current || !pointerStart.current) return;
		const dx = e.clientX - pointerStart.current.x;
		const dy = e.clientY - pointerStart.current.y;
		if (isClick.current && Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) {
			isClick.current = false;
			setIsDragging(true);
		}
		if (!isClick.current) {
			const rect = rectRef.current;
			if (rect && trackRef.current) if (e.clientX < rect.left) {
				const stretch = computeStretch(e.clientX, -1);
				trackRef.current.style.width = `calc(100% + ${Math.abs(stretch)}px)`;
				trackRef.current.style.transform = `translateX(${stretch}px)`;
			} else if (e.clientX > rect.right) {
				const stretch = computeStretch(e.clientX, 1);
				trackRef.current.style.width = `calc(100% + ${stretch}px)`;
				trackRef.current.style.transform = "translateX(0)";
			} else {
				trackRef.current.style.width = "100%";
				trackRef.current.style.transform = "translateX(0)";
			}
			const newVal = positionToValue(e.clientX);
			const pct = (newVal - min) / (max - min) * 100;
			if (animHandle.current) {
				animHandle.current.stop();
				animHandle.current = null;
			}
			setFillPercent(pct);
			onChange(roundValue(newVal, step));
		}
	}, [
		positionToValue,
		onChange,
		min,
		max,
		step,
		setFillPercent,
		computeStretch
	]);
	const handlePointerUp = q$1((e) => {
		if (!interacting.current) return;
		if (isClick.current) {
			const rawVal = positionToValue(e.clientX);
			const snapped = (max - min) / step <= 10 ? Math.max(min, Math.min(max, min + Math.round((rawVal - min) / step) * step)) : snapToDecile(rawVal, min, max);
			const targetPct = (snapped - min) / (max - min) * 100;
			const currentPct = (value - min) / (max - min) * 100;
			if (animHandle.current) animHandle.current.stop();
			animHandle.current = animateSpring(currentPct, targetPct, {
				stiffness: 300,
				damping: 25,
				mass: .8
			}, (v) => setFillPercent(v), () => {
				animHandle.current = null;
			});
			onChange(roundValue(snapped, step));
		}
		if (trackRef.current) {
			trackRef.current.style.transition = "width 0.3s cubic-bezier(0,0,0.2,1), transform 0.3s cubic-bezier(0,0,0.2,1)";
			trackRef.current.style.width = "100%";
			trackRef.current.style.transform = "translateX(0)";
			setTimeout(() => {
				if (trackRef.current) trackRef.current.style.transition = "";
			}, 300);
		}
		interacting.current = false;
		setIsDragging(false);
		pointerStart.current = null;
	}, [
		positionToValue,
		onChange,
		min,
		max,
		step,
		value,
		setFillPercent
	]);
	const hoverTimeout = A$1(null);
	y(() => {
		if (isValueHovered && !isEditing && !isValueEditable) hoverTimeout.current = setTimeout(() => setIsValueEditable(true), 800);
		else if (!isValueHovered && !isEditing) {
			if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
			setIsValueEditable(false);
		}
		return () => {
			if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
		};
	}, [
		isValueHovered,
		isEditing,
		isValueEditable
	]);
	y(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);
	const submitEdit = q$1(() => {
		const parsed = parseFloat(editValue);
		if (!isNaN(parsed)) onChange(roundValue(Math.max(min, Math.min(max, parsed)), step));
		setIsEditing(false);
		setIsValueHovered(false);
		setIsValueEditable(false);
	}, [
		editValue,
		onChange,
		min,
		max,
		step
	]);
	const isActive = isHovered || isDragging;
	const displayValue = value.toFixed(decimalsForStep(step));
	const discreteSteps = (max - min) / step;
	const hashCount = discreteSteps <= 10 ? discreteSteps - 1 : 9;
	const hashMarks = Array.from({ length: Math.max(0, hashCount) }, (_, i) => {
		return /* @__PURE__ */ u("div", {
			class: "up-slider-hashmark",
			style: { left: `${discreteSteps <= 10 ? (i + 1) * step / (max - min) * 100 : (i + 1) * 10}%` }
		}, i);
	});
	return /* @__PURE__ */ u("div", {
		ref: wrapRef,
		class: "up-slider-wrap",
		children: /* @__PURE__ */ u("div", {
			ref: trackRef,
			class: [
				"up-slider",
				isActive ? "up-slider-active" : "",
				isDragging ? "up-slider-dragging" : ""
			].filter(Boolean).join(" "),
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			onMouseEnter: () => setIsHovered(true),
			onMouseLeave: () => setIsHovered(false),
			children: [
				/* @__PURE__ */ u("div", {
					class: "up-slider-hashmarks",
					children: hashMarks
				}),
				/* @__PURE__ */ u("div", {
					ref: fillRef,
					class: "up-slider-fill",
					style: {
						width: `${percentage}%`,
						background: isActive ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"
					}
				}),
				/* @__PURE__ */ u("div", {
					ref: handleRef,
					class: "up-slider-handle",
					style: { left: `max(5px, calc(${percentage}% - 9px))` }
				}),
				/* @__PURE__ */ u("span", {
					class: "up-slider-label",
					children: label
				}),
				isEditing ? /* @__PURE__ */ u("input", {
					ref: inputRef,
					type: "text",
					class: "up-slider-input",
					value: editValue,
					onInput: (e) => setEditValue(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") submitEdit();
						if (e.key === "Escape") {
							setIsEditing(false);
							setIsValueHovered(false);
						}
					},
					onBlur: submitEdit,
					onClick: (e) => e.stopPropagation(),
					onMouseDown: (e) => e.stopPropagation()
				}) : /* @__PURE__ */ u("span", {
					class: `up-slider-value ${isValueEditable ? "up-slider-value-editable" : ""}`,
					onMouseEnter: () => setIsValueHovered(true),
					onMouseLeave: () => setIsValueHovered(false),
					onClick: (e) => {
						if (isValueEditable) {
							e.stopPropagation();
							e.preventDefault();
							setIsEditing(true);
							setEditValue(displayValue);
						}
					},
					onMouseDown: (e) => {
						if (isValueEditable) e.stopPropagation();
					},
					children: displayValue
				})
			]
		})
	});
}
//#endregion
//#region src/ui/Slot.tsx
function Slot({ panelId, path, label }) {
	const slotRef = A$1(null);
	const [isEmpty, setIsEmpty] = d(true);
	y(() => {
		const el = slotRef.current;
		if (!el) return;
		PaneStore.setSlotNode(panelId, path, el);
		setIsEmpty(el.childNodes.length === 0);
		const observer = new MutationObserver(() => {
			setIsEmpty(el.childNodes.length === 0);
		});
		observer.observe(el, { childList: true });
		return () => {
			observer.disconnect();
			PaneStore.setSlotNode(panelId, path, null);
		};
	}, [panelId, path]);
	return /* @__PURE__ */ u("div", {
		class: `up-slot-wrap ${isEmpty ? "up-slot-wrap-empty" : ""}`,
		children: [label ? /* @__PURE__ */ u("div", {
			class: "up-slot-label",
			children: label
		}) : null, /* @__PURE__ */ u("div", {
			ref: slotRef,
			class: "up-slot"
		})]
	});
}
//#endregion
//#region src/ui/Transition.tsx
function generateSpringCurve(stiffness, damping, mass, duration) {
	const points = [];
	const steps = 100;
	const dt = duration / steps;
	let position = 0;
	let velocity = 0;
	for (let i = 0; i <= steps; i++) {
		const time = i * dt;
		points.push([time, position]);
		const springForce = -stiffness * (position - 1);
		const dampForce = -damping * velocity;
		velocity += (springForce + dampForce) / mass * dt;
		position += velocity * dt;
	}
	return points;
}
function SpringViz({ spring, isSimple }) {
	const W = 256;
	const H = 140;
	let stiffness;
	let damping;
	let mass;
	if (isSimple) {
		const vd = spring.visualDuration ?? .3;
		const bounce = spring.bounce ?? .2;
		mass = 1;
		stiffness = Math.pow(2 * Math.PI / vd, 2);
		damping = 2 * (1 - bounce) * Math.sqrt(stiffness * mass);
	} else {
		stiffness = spring.stiffness ?? 400;
		damping = spring.damping ?? 17;
		mass = spring.mass ?? 1;
	}
	const pts = generateSpringCurve(stiffness, damping, mass, 2);
	const vals = pts.map(([, v]) => v);
	const lo = Math.min(...vals);
	const range = Math.max(...vals) - lo || 1;
	const d = pts.map(([t, v], i) => {
		const x = t / 2 * W;
		const y = H - ((v - lo) / range * H * .6 + H * .2);
		return `${i === 0 ? "M" : "L"} ${x} ${y}`;
	}).join(" ");
	return /* @__PURE__ */ u("svg", {
		viewBox: `0 0 ${W} ${H}`,
		class: "up-viz",
		children: [/* @__PURE__ */ u("line", {
			x1: 0,
			y1: H / 2,
			x2: W,
			y2: H / 2,
			stroke: "rgba(255,255,255,0.15)",
			"stroke-width": "1",
			"stroke-dasharray": "4,4"
		}), /* @__PURE__ */ u("path", {
			d,
			fill: "none",
			stroke: "rgba(255,255,255,0.6)",
			"stroke-width": "2",
			"stroke-linecap": "round"
		})]
	});
}
function EasingViz({ easing }) {
	const S = 200;
	const pad = 10;
	const unit = (S - pad * 2) / 2;
	const toSvg = (nx, ny) => ({
		x: pad + (nx + .5) * unit,
		y: pad + (1.5 - ny) * unit
	});
	const start = toSvg(0, 0);
	const end = toSvg(1, 1);
	const p1 = toSvg(easing.ease[0], easing.ease[1]);
	const p2 = toSvg(easing.ease[2], easing.ease[3]);
	return /* @__PURE__ */ u("svg", {
		viewBox: `0 0 ${S} ${S}`,
		preserveAspectRatio: "xMidYMid slice",
		class: "up-viz",
		style: { aspectRatio: "256/140" },
		children: [/* @__PURE__ */ u("line", {
			x1: start.x,
			y1: start.y,
			x2: end.x,
			y2: end.y,
			stroke: "rgba(255,255,255,0.15)",
			"stroke-width": "1",
			"stroke-dasharray": "4,4"
		}), /* @__PURE__ */ u("path", {
			d: `M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`,
			fill: "none",
			stroke: "rgba(255,255,255,0.6)",
			"stroke-width": "2",
			"stroke-linecap": "round"
		})]
	});
}
function TransitionControl({ panelId, path, label, value, onChange }) {
	const mode = PaneStore.getTransitionMode(panelId, path);
	const isEasing = mode === "easing";
	const isSimple = mode === "simple";
	const spring = value.type === "spring" ? value : {
		type: "spring",
		visualDuration: .3,
		bounce: .2
	};
	const easing = value.type === "easing" ? value : {
		type: "easing",
		duration: .3,
		ease: [
			1,
			-.4,
			.5,
			1
		]
	};
	const handleModeChange = q$1((newMode) => {
		PaneStore.setTransitionMode(panelId, path, newMode);
		if (newMode === "easing") onChange({
			type: "easing",
			duration: value.type === "spring" ? value.visualDuration ?? .3 : value.duration,
			ease: easing.ease
		});
		else if (newMode === "simple") onChange({
			type: "spring",
			visualDuration: spring.visualDuration ?? (value.type === "easing" ? value.duration : .3),
			bounce: spring.bounce ?? .2
		});
		else onChange({
			type: "spring",
			stiffness: spring.stiffness ?? 200,
			damping: spring.damping ?? 25,
			mass: spring.mass ?? 1
		});
	}, [
		panelId,
		path,
		value,
		spring,
		easing,
		onChange
	]);
	const updateSpring = q$1((key, val) => {
		if (isSimple) {
			const { stiffness: _s, damping: _d, mass: _m, ...rest } = spring;
			onChange({
				...rest,
				[key]: val
			});
		} else {
			const { visualDuration: _v, bounce: _b, ...rest } = spring;
			onChange({
				...rest,
				[key]: val
			});
		}
	}, [
		spring,
		isSimple,
		onChange
	]);
	const updateEase = q$1((index, val) => {
		const newEase = [...easing.ease];
		newEase[index] = val;
		onChange({
			...easing,
			ease: newEase
		});
	}, [easing, onChange]);
	return /* @__PURE__ */ u(Folder, {
		title: label,
		defaultOpen: true,
		children: /* @__PURE__ */ u("div", {
			style: {
				display: "flex",
				flexDirection: "column",
				gap: "6px"
			},
			children: [
				isEasing ? /* @__PURE__ */ u(EasingViz, { easing }) : /* @__PURE__ */ u(SpringViz, {
					spring,
					isSimple
				}),
				/* @__PURE__ */ u("div", {
					class: "up-labeled-row",
					children: [/* @__PURE__ */ u("span", {
						class: "up-labeled-row-label",
						children: "Type"
					}), /* @__PURE__ */ u(SegmentedControl, {
						options: [
							{
								value: "easing",
								label: "Easing"
							},
							{
								value: "simple",
								label: "Time"
							},
							{
								value: "advanced",
								label: "Physics"
							}
						],
						value: mode,
						onChange: handleModeChange
					})]
				}),
				isEasing ? /* @__PURE__ */ u(k$1, { children: [
					/* @__PURE__ */ u(Slider, {
						label: "x1",
						value: easing.ease[0],
						onChange: (v) => updateEase(0, v),
						min: 0,
						max: 1,
						step: .01
					}),
					/* @__PURE__ */ u(Slider, {
						label: "y1",
						value: easing.ease[1],
						onChange: (v) => updateEase(1, v),
						min: -1,
						max: 2,
						step: .01
					}),
					/* @__PURE__ */ u(Slider, {
						label: "x2",
						value: easing.ease[2],
						onChange: (v) => updateEase(2, v),
						min: 0,
						max: 1,
						step: .01
					}),
					/* @__PURE__ */ u(Slider, {
						label: "y2",
						value: easing.ease[3],
						onChange: (v) => updateEase(3, v),
						min: -1,
						max: 2,
						step: .01
					}),
					/* @__PURE__ */ u(Slider, {
						label: "Duration",
						value: easing.duration,
						onChange: (v) => onChange({
							...easing,
							duration: v
						}),
						min: .1,
						max: 2,
						step: .05
					})
				] }) : isSimple ? /* @__PURE__ */ u(k$1, { children: [/* @__PURE__ */ u(Slider, {
					label: "Duration",
					value: spring.visualDuration ?? .3,
					onChange: (v) => updateSpring("visualDuration", v),
					min: .1,
					max: 1,
					step: .05
				}), /* @__PURE__ */ u(Slider, {
					label: "Bounce",
					value: spring.bounce ?? .2,
					onChange: (v) => updateSpring("bounce", v),
					min: 0,
					max: 1,
					step: .05
				})] }) : /* @__PURE__ */ u(k$1, { children: [
					/* @__PURE__ */ u(Slider, {
						label: "Stiffness",
						value: spring.stiffness ?? 400,
						onChange: (v) => updateSpring("stiffness", v),
						min: 1,
						max: 1e3,
						step: 10
					}),
					/* @__PURE__ */ u(Slider, {
						label: "Damping",
						value: spring.damping ?? 17,
						onChange: (v) => updateSpring("damping", v),
						min: 1,
						max: 100,
						step: 1
					}),
					/* @__PURE__ */ u(Slider, {
						label: "Mass",
						value: spring.mass ?? 1,
						onChange: (v) => updateSpring("mass", v),
						min: .1,
						max: 10,
						step: .1
					})
				] })
			]
		})
	});
}
//#endregion
//#region src/ui/Panel.tsx
function Panel({ panel, values, portalContainer }) {
	const renderControl = (control) => {
		const value = values[control.path];
		switch (control.type) {
			case "slider": return /* @__PURE__ */ u(Slider, {
				label: control.label,
				value,
				onChange: (v) => PaneStore.updateValue(panel.id, control.path, v),
				min: control.min ?? 0,
				max: control.max ?? 100,
				step: control.step ?? 1
			}, control.path);
			case "toggle": return /* @__PURE__ */ u(Toggle, {
				label: control.label,
				checked: value,
				onChange: (v) => PaneStore.updateValue(panel.id, control.path, v)
			}, control.path);
			case "action": return /* @__PURE__ */ u(Action, {
				label: control.label,
				onClick: () => PaneStore.triggerAction(panel.id, control.path)
			}, control.path);
			case "slot": return /* @__PURE__ */ u(Slot, {
				panelId: panel.id,
				path: control.path,
				label: control.label
			}, control.path);
			case "select": return /* @__PURE__ */ u(Select, {
				label: control.label,
				value,
				options: control.options ?? [],
				onChange: (v) => PaneStore.updateValue(panel.id, control.path, v),
				portalContainer
			}, control.path);
			case "text": return /* @__PURE__ */ u(TextInput, {
				label: control.label,
				value,
				onChange: (v) => PaneStore.updateValue(panel.id, control.path, v),
				placeholder: control.placeholder
			}, control.path);
			case "color": return /* @__PURE__ */ u(ColorPicker, {
				label: control.label,
				value,
				onChange: (v) => PaneStore.updateValue(panel.id, control.path, v)
			}, control.path);
			case "transition": return /* @__PURE__ */ u(TransitionControl, {
				panelId: panel.id,
				path: control.path,
				label: control.label,
				value,
				onChange: (v) => PaneStore.updateValue(panel.id, control.path, v)
			}, control.path);
			case "folder": return /* @__PURE__ */ u(Folder, {
				title: control.label,
				defaultOpen: control.defaultOpen,
				children: control.children?.map(renderControl)
			}, control.path);
			default: return null;
		}
	};
	return /* @__PURE__ */ u("div", {
		class: "up-panel-section",
		children: panel.controls.map(renderControl)
	});
}
//#endregion
//#region src/ui/App.tsx
const LS_KEY = "uipane-widget";
const LS_COLLAPSED_KEY = "uipane-collapsed";
function loadLS(key) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
function saveLS(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {}
}
function SettingsIcon() {
	return /* @__PURE__ */ u("svg", {
		viewBox: "0 0 16 16",
		fill: "none",
		children: [
			/* @__PURE__ */ u("path", {
				opacity: "0.5",
				d: "M6.85 11.75C6.79 11.99 6.75 12.24 6.75 12.5s.04.51.1.75H2a.75.75 0 010-1.5h4.85zM14 11.75a.75.75 0 010 1.5h-1.35c.06-.24.1-.49.1-.75s-.04-.51-.1-.75H14zM3.1 7.25C3.04 7.49 3 7.74 3 8s.04.51.1.75H2a.75.75 0 010-1.5h1.1zM14 7.25a.75.75 0 010 1.5H8.9c.06-.24.1-.49.1-.75s-.04-.51-.1-.75H14zM7.6 2.75c-.06.24-.1.49-.1.75s.04.51.1.75H2a.75.75 0 010-1.5h5.6zM14 2.75a.75.75 0 010 1.5h-.6c.06-.24.1-.49.1-.75s-.04-.51-.1-.75H14z",
				fill: "currentColor"
			}),
			/* @__PURE__ */ u("circle", {
				cx: "6",
				cy: "8",
				r: "1",
				fill: "currentColor",
				stroke: "currentColor",
				"stroke-width": "1.25"
			}),
			/* @__PURE__ */ u("circle", {
				cx: "10.5",
				cy: "3.5",
				r: "1",
				fill: "currentColor",
				stroke: "currentColor",
				"stroke-width": "1.25"
			}),
			/* @__PURE__ */ u("circle", {
				cx: "9.75",
				cy: "12.5",
				r: "1",
				fill: "currentColor",
				stroke: "currentColor",
				"stroke-width": "1.25"
			})
		]
	});
}
function App({ portalContainer, childrenSlot }) {
	const adoptSlot = q$1((el) => {
		if (el && childrenSlot && childrenSlot.parentNode !== el) el.appendChild(childrenSlot);
	}, [childrenSlot]);
	const shellRef = A$1(null);
	const [panels, setPanels] = d([]);
	const [values, setValues] = d({});
	const [activeTab, setActiveTab] = d(0);
	const savedShell = loadLS(LS_KEY);
	const savedCollapsed = loadLS(LS_COLLAPSED_KEY);
	const [corner, setCorner] = d(savedShell?.corner ?? "bottom-right");
	const [width, setWidth] = d(savedShell?.width ?? 320);
	const [height, setHeight] = d(savedShell?.height ?? 420);
	const [collapsed, setCollapsed] = d(savedCollapsed);
	y(() => {
		const update = () => {
			const p = PaneStore.getPanels();
			setPanels(p);
			const v = {};
			for (const panel of p) v[panel.id] = PaneStore.getValues(panel.id);
			setValues(v);
		};
		update();
		return PaneStore.subscribeGlobal(update);
	}, []);
	y(() => {
		const unsubs = [];
		for (const panel of panels) unsubs.push(PaneStore.subscribe(panel.id, () => {
			setValues((prev) => ({
				...prev,
				[panel.id]: PaneStore.getValues(panel.id)
			}));
		}));
		return () => unsubs.forEach((u) => u());
	}, [panels]);
	y(() => {
		saveLS(LS_KEY, {
			corner,
			width,
			height
		});
	}, [
		corner,
		width,
		height
	]);
	y(() => {
		if (collapsed) saveLS(LS_COLLAPSED_KEY, collapsed);
		else localStorage.removeItem(LS_COLLAPSED_KEY);
	}, [collapsed]);
	const pos = collapsed ? getCollapsedPosition(collapsed.corner, collapsed.orientation) : calculatePosition(corner, width, height);
	const handleDrag = q$1((e) => {
		if (e.target.closest("button")) return;
		e.preventDefault();
		const shell = shellRef.current;
		if (!shell) return;
		const initMX = e.clientX;
		const initMY = e.clientY;
		const initX = pos.x;
		const initY = pos.y;
		let lastMX = initMX;
		let lastMY = initMY;
		let hasMoved = false;
		let rafId = null;
		shell.classList.add("up-shell-dragging");
		const onMove = (ev) => {
			if (rafId) return;
			hasMoved = true;
			lastMX = ev.clientX;
			lastMY = ev.clientY;
			rafId = requestAnimationFrame(() => {
				const cx = initX + (lastMX - initMX);
				const cy = initY + (lastMY - initMY);
				shell.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
				const r = cx + width;
				const b = cy + height;
				const outL = Math.max(0, -cx);
				const outR = Math.max(0, r - window.innerWidth);
				const outT = Math.max(0, -cy);
				const outB = Math.max(0, b - window.innerHeight);
				const hOut = Math.min(width, outL + outR);
				const vOut = Math.min(height, outT + outB);
				if (hOut * height + vOut * width - hOut * vOut > width * height * .35) {
					const wcx = cx + width / 2;
					const wcy = cy + height / 2;
					const scx = window.innerWidth / 2;
					const scy = window.innerHeight / 2;
					const tCorner = wcx < scx ? wcy < scy ? "top-left" : "bottom-left" : wcy < scy ? "top-right" : "bottom-right";
					const orientation = Math.max(outL, outR) > Math.max(outT, outB) ? "horizontal" : "vertical";
					setCorner(tCorner);
					setCollapsed({
						corner: tCorner,
						orientation
					});
					cleanup();
				}
				rafId = null;
			});
		};
		const onUp = () => {
			cleanup();
			shell.classList.remove("up-shell-dragging");
			const totalMove = Math.sqrt((lastMX - initMX) ** 2 + (lastMY - initMY) ** 2);
			if (!hasMoved || totalMove < 60) {
				shell.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
				return;
			}
			const newCorner = getBestCorner(lastMX, lastMY, initMX, initMY);
			const snapped = calculatePosition(newCorner, width, height);
			shell.style.transition = "transform 0.25s cubic-bezier(0, 0, 0.2, 1)";
			shell.style.transform = `translate3d(${snapped.x}px, ${snapped.y}px, 0)`;
			const onEnd = () => {
				shell.style.transition = "";
				shell.removeEventListener("transitionend", onEnd);
			};
			shell.addEventListener("transitionend", onEnd);
			setCorner(newCorner);
		};
		const cleanup = () => {
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
			if (rafId) cancelAnimationFrame(rafId);
		};
		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
	}, [
		pos.x,
		pos.y,
		width,
		height
	]);
	const handleCollapsedDrag = q$1((e) => {
		if (!collapsed) return;
		e.preventDefault();
		const initMX = e.clientX;
		const initMY = e.clientY;
		const threshold = 50;
		const onMove = (ev) => {
			const dx = ev.clientX - initMX;
			const dy = ev.clientY - initMY;
			let expand = false;
			if (collapsed.orientation === "horizontal") {
				if (collapsed.corner.endsWith("left") && dx > threshold) expand = true;
				if (collapsed.corner.endsWith("right") && dx < -threshold) expand = true;
			} else {
				if (collapsed.corner.startsWith("top") && dy > threshold) expand = true;
				if (collapsed.corner.startsWith("bottom") && dy < -threshold) expand = true;
			}
			if (expand) {
				setCollapsed(null);
				setCorner(collapsed.corner);
				done();
			}
		};
		const onUp = () => done();
		const done = () => {
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
		};
		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
	}, [collapsed]);
	const handleResize = q$1((handle, e) => {
		e.preventDefault();
		e.stopPropagation();
		const initMX = e.clientX;
		const initMY = e.clientY;
		const initW = width;
		const initH = height;
		const initPos = calculatePosition(corner, width, height);
		const shell = shellRef.current;
		if (!shell) return;
		shell.classList.add("up-shell-dragging");
		const onMove = (ev) => {
			const dx = ev.clientX - initMX;
			const dy = ev.clientY - initMY;
			const result = calculateResizedSizeAndPosition(handle, initW, initH, initPos.x, initPos.y, dx, dy);
			setWidth(result.width);
			setHeight(result.height);
			shell.style.transform = `translate3d(${result.x}px, ${result.y}px, 0)`;
		};
		const onUp = () => {
			shell.classList.remove("up-shell-dragging");
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
		};
		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
	}, [
		width,
		height,
		corner
	]);
	const resizeHandles = (() => {
		const [v, h] = corner.split("-");
		const handles = [];
		if (v === "top") handles.push("bottom");
		else handles.push("top");
		if (h === "left") handles.push("right");
		else handles.push("left");
		handles.push(`${v === "top" ? "bottom" : "top"}-${h === "left" ? "right" : "left"}`);
		return handles;
	})();
	if (panels.length === 0) return null;
	if (collapsed) {
		const cPos = getCollapsedPosition(collapsed.corner, collapsed.orientation);
		return /* @__PURE__ */ u("div", {
			class: "up-collapsed",
			style: { transform: `translate3d(${cPos.x}px, ${cPos.y}px, 0)` },
			onPointerDown: handleCollapsedDrag,
			children: /* @__PURE__ */ u(SettingsIcon, {})
		});
	}
	const currentPanel = panels[activeTab] ?? panels[0];
	const currentValues = currentPanel ? values[currentPanel.id] ?? {} : {};
	y(() => {
		if (currentPanel) PaneStore.setActiveTab(currentPanel.name);
	}, [currentPanel?.name]);
	return /* @__PURE__ */ u("div", {
		ref: shellRef,
		class: "up-shell",
		style: {
			width: `${width}px`,
			height: `${height}px`,
			transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`
		},
		children: [
			/* @__PURE__ */ u("div", {
				class: "up-header",
				onPointerDown: handleDrag,
				children: /* @__PURE__ */ u("div", {
					class: "up-header-left",
					children: /* @__PURE__ */ u("span", {
						class: "up-header-title",
						children: panels.length === 1 ? currentPanel?.name ?? "uipane" : "uipane"
					})
				})
			}),
			panels.length > 1 && /* @__PURE__ */ u("div", {
				class: "up-tabs",
				children: panels.map((panel, i) => /* @__PURE__ */ u("button", {
					class: `up-tab ${i === activeTab ? "up-tab-active" : ""}`,
					onClick: () => setActiveTab(i),
					children: panel.name
				}, panel.id))
			}),
			/* @__PURE__ */ u("div", {
				class: "up-content",
				children: [/* @__PURE__ */ u("div", { ref: adoptSlot }), currentPanel && /* @__PURE__ */ u(Panel, {
					panel: currentPanel,
					values: currentValues,
					portalContainer
				})]
			}),
			resizeHandles.map((h) => /* @__PURE__ */ u("div", {
				class: `up-resize up-resize-${h}`,
				onPointerDown: (e) => handleResize(h, e)
			}, h))
		]
	});
}
//#endregion
//#region src/mount.ts
let mounted = false;
let cleanup = null;
let childrenSlotEl = null;
function getChildrenSlot() {
	return childrenSlotEl;
}
function initPane() {
	if (mounted && cleanup) return cleanup;
	const host = document.createElement("div");
	host.id = "uipane-root";
	host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483645;pointer-events:none;";
	document.documentElement.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });
	const style = document.createElement("style");
	style.textContent = STYLES;
	shadow.appendChild(style);
	const portalContainer = document.createElement("div");
	portalContainer.className = "up-portal";
	shadow.appendChild(portalContainer);
	childrenSlotEl = document.createElement("div");
	childrenSlotEl.className = "up-children";
	const container = document.createElement("div");
	container.className = "up-root";
	container.style.cssText = "pointer-events:auto;";
	shadow.appendChild(container);
	J$1(_$1(App, {
		portalContainer,
		childrenSlot: childrenSlotEl
	}), container);
	mounted = true;
	cleanup = () => {
		J$1(null, container);
		host.remove();
		mounted = false;
		cleanup = null;
		childrenSlotEl = null;
	};
	return cleanup;
}
//#endregion
//#region src/react/PaneRoot.ts
function PaneRoot(props) {
	const [slot, setSlot] = useState(null);
	useEffect(() => {
		const cleanup = initPane();
		setSlot(getChildrenSlot());
		return cleanup;
	}, []);
	if (props.children && slot) return createPortal(props.children, slot);
	return null;
}
//#endregion
//#region src/react/PaneSlot.tsx
function PaneSlot({ panel, path, children }) {
	const panelId = useSyncExternalStore((cb) => PaneStore.subscribeGlobal(cb), () => PaneStore.getPanels().find((p) => p.name === panel)?.id ?? null, () => null);
	const slotNode = useSyncExternalStore((cb) => panelId ? PaneStore.subscribeSlot(panelId, path, cb) : () => {}, () => panelId ? PaneStore.getSlotNode(panelId, path) : null, () => null);
	if (!slotNode || !children) return null;
	return createPortal(children, slotNode);
}
//#endregion
//#region src/react/useActiveTab.ts
function useActiveTab() {
	return useSyncExternalStore((cb) => PaneStore.subscribeActiveTab(cb), () => PaneStore.getActiveTab(), () => PaneStore.getActiveTab());
}
//#endregion
export { PaneRoot, PaneSlot, PaneStore, initPane, useActiveTab, usePane };
