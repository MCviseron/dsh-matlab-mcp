window.__ModuleLoader__.load({
  id: "dsh-matlab-mcp",
  factory: (require) => {
"use strict";

    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/MatlabMcpSettingsCard.tsx
var import_react = require("react");

var import_meta = {};
var createStoreImpl = (createState) => {
  let state;
  const listeners = /* @__PURE__ */ new Set();
  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };
  const getState = () => state;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const destroy = () => {
    if ((import_meta.env ? import_meta.env.MODE : void 0) !== "production") {
      console.warn(
        "[DEPRECATED] The `destroy` method will be unsupported in a future version. Instead use unsubscribe function returned by subscribe. Everything will be garbage-collected if store is garbage-collected."
      );
    }
    listeners.clear();
  };
  const api = { setState, getState, subscribe, destroy };
  state = createState(setState, getState, api);
  return api;
};
var createStore = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;

var subscribeWithSelectorImpl = (fn) => (set2, get, api) => {
  const origSubscribe = api.subscribe;
  api.subscribe = (selector, optListener, options) => {
    let listener = selector;
    if (optListener) {
      const equalityFn = (options == null ? void 0 : options.equalityFn) || Object.is;
      let currentSlice = selector(api.getState());
      listener = (state) => {
        const nextSlice = selector(state);
        if (!equalityFn(currentSlice, nextSlice)) {
          const previousSlice = currentSlice;
          optListener(currentSlice = nextSlice, previousSlice);
        }
      };
      if (options == null ? void 0 : options.fireImmediately) {
        optListener(currentSlice, currentSlice);
      }
    }
    return origSubscribe(listener);
  };
  const initialState = fn(set2, get, api);
  return initialState;
};
var subscribeWithSelector = subscribeWithSelectorImpl;

var NOTHING = Symbol.for("immer-nothing");
var DRAFTABLE = Symbol.for("immer-draftable");
var DRAFT_STATE = Symbol.for("immer-state");
var errors = true ? [
  // All error codes, starting by 0:
  function(plugin) {
    return `The plugin for '${plugin}' has not been loaded into Immer. To enable the plugin, import and call \`enable${plugin}()\` when initializing your application.`;
  },
  function(thing) {
    return `produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got '${thing}'`;
  },
  "This object has been frozen and should not be mutated",
  function(data) {
    return "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? " + data;
  },
  "An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.",
  "Immer forbids circular references",
  "The first or second argument to `produce` must be a function",
  "The third argument to `produce` must be a function or undefined",
  "First argument to `createDraft` must be a plain object, an array, or an immerable object",
  "First argument to `finishDraft` must be a draft returned by `createDraft`",
  function(thing) {
    return `'current' expects a draft, got: ${thing}`;
  },
  "Object.defineProperty() cannot be used on an Immer draft",
  "Object.setPrototypeOf() cannot be used on an Immer draft",
  "Immer only supports deleting array indices",
  "Immer only supports setting array indices and the 'length' property",
  function(thing) {
    return `'original' expects a draft, got: ${thing}`;
  }
  // Note: if more errors are added, the errorOffset in Patches.ts should be increased
  // See Patches.ts for additional errors
] : [];
function die(error, ...args) {
  if (true) {
    const e = errors[error];
    const msg = typeof e === "function" ? e.apply(null, args) : e;
    throw new Error(`[Immer] ${msg}`);
  }
  throw new Error(
    `[Immer] minified error nr: ${error}. Full error at: https://bit.ly/3cXEKWf`
  );
}
var getPrototypeOf = Object.getPrototypeOf;
function isDraft(value) {
  return !!value && !!value[DRAFT_STATE];
}
function isDraftable(value) {
  if (!value)
    return false;
  return isPlainObject(value) || Array.isArray(value) || !!value[DRAFTABLE] || !!value.constructor?.[DRAFTABLE] || isMap(value) || isSet(value);
}
var objectCtorString = Object.prototype.constructor.toString();
var cachedCtorStrings = /* @__PURE__ */ new WeakMap();
function isPlainObject(value) {
  if (!value || typeof value !== "object")
    return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null || proto === Object.prototype)
    return true;
  const Ctor = Object.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  if (Ctor === Object)
    return true;
  if (typeof Ctor !== "function")
    return false;
  let ctorString = cachedCtorStrings.get(Ctor);
  if (ctorString === void 0) {
    ctorString = Function.toString.call(Ctor);
    cachedCtorStrings.set(Ctor, ctorString);
  }
  return ctorString === objectCtorString;
}
function each(obj, iter, strict = true) {
  if (getArchtype(obj) === 0) {
    const keys = strict ? Reflect.ownKeys(obj) : Object.keys(obj);
    keys.forEach((key) => {
      iter(key, obj[key], obj);
    });
  } else {
    obj.forEach((entry, index) => iter(index, entry, obj));
  }
}
function getArchtype(thing) {
  const state = thing[DRAFT_STATE];
  return state ? state.type_ : Array.isArray(thing) ? 1 : isMap(thing) ? 2 : isSet(thing) ? 3 : 0;
}
function has(thing, prop) {
  return getArchtype(thing) === 2 ? thing.has(prop) : Object.prototype.hasOwnProperty.call(thing, prop);
}
function set(thing, propOrOldValue, value) {
  const t = getArchtype(thing);
  if (t === 2)
    thing.set(propOrOldValue, value);
  else if (t === 3) {
    thing.add(value);
  } else
    thing[propOrOldValue] = value;
}
function is(x, y) {
  if (x === y) {
    return x !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}
function isMap(target) {
  return target instanceof Map;
}
function isSet(target) {
  return target instanceof Set;
}
function latest(state) {
  return state.copy_ || state.base_;
}
function shallowCopy(base, strict) {
  if (isMap(base)) {
    return new Map(base);
  }
  if (isSet(base)) {
    return new Set(base);
  }
  if (Array.isArray(base))
    return Array.prototype.slice.call(base);
  const isPlain = isPlainObject(base);
  if (strict === true || strict === "class_only" && !isPlain) {
    const descriptors = Object.getOwnPropertyDescriptors(base);
    delete descriptors[DRAFT_STATE];
    let keys = Reflect.ownKeys(descriptors);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const desc = descriptors[key];
      if (desc.writable === false) {
        desc.writable = true;
        desc.configurable = true;
      }
      if (desc.get || desc.set)
        descriptors[key] = {
          configurable: true,
          writable: true,
          // could live with !!desc.set as well here...
          enumerable: desc.enumerable,
          value: base[key]
        };
    }
    return Object.create(getPrototypeOf(base), descriptors);
  } else {
    const proto = getPrototypeOf(base);
    if (proto !== null && isPlain) {
      return { ...base };
    }
    const obj = Object.create(proto);
    return Object.assign(obj, base);
  }
}
function freeze(obj, deep = false) {
  if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj))
    return obj;
  if (getArchtype(obj) > 1) {
    Object.defineProperties(obj, {
      set: dontMutateMethodOverride,
      add: dontMutateMethodOverride,
      clear: dontMutateMethodOverride,
      delete: dontMutateMethodOverride
    });
  }
  Object.freeze(obj);
  if (deep)
    Object.values(obj).forEach((value) => freeze(value, true));
  return obj;
}
function dontMutateFrozenCollections() {
  die(2);
}
var dontMutateMethodOverride = {
  value: dontMutateFrozenCollections
};
function isFrozen(obj) {
  if (obj === null || typeof obj !== "object")
    return true;
  return Object.isFrozen(obj);
}
var plugins = {};
function getPlugin(pluginKey) {
  const plugin = plugins[pluginKey];
  if (!plugin) {
    die(0, pluginKey);
  }
  return plugin;
}
var currentScope;
function getCurrentScope() {
  return currentScope;
}
function createScope(parent_, immer_) {
  return {
    drafts_: [],
    parent_,
    immer_,
    // Whenever the modified draft contains a draft from another scope, we
    // need to prevent auto-freezing so the unowned draft can be finalized.
    canAutoFreeze_: true,
    unfinalizedDrafts_: 0
  };
}
function usePatchesInScope(scope, patchListener) {
  if (patchListener) {
    getPlugin("Patches");
    scope.patches_ = [];
    scope.inversePatches_ = [];
    scope.patchListener_ = patchListener;
  }
}
function revokeScope(scope) {
  leaveScope(scope);
  scope.drafts_.forEach(revokeDraft);
  scope.drafts_ = null;
}
function leaveScope(scope) {
  if (scope === currentScope) {
    currentScope = scope.parent_;
  }
}
function enterScope(immer2) {
  return currentScope = createScope(currentScope, immer2);
}
function revokeDraft(draft) {
  const state = draft[DRAFT_STATE];
  if (state.type_ === 0 || state.type_ === 1)
    state.revoke_();
  else
    state.revoked_ = true;
}
function processResult(result, scope) {
  scope.unfinalizedDrafts_ = scope.drafts_.length;
  const baseDraft = scope.drafts_[0];
  const isReplaced = result !== void 0 && result !== baseDraft;
  if (isReplaced) {
    if (baseDraft[DRAFT_STATE].modified_) {
      revokeScope(scope);
      die(4);
    }
    if (isDraftable(result)) {
      result = finalize(scope, result);
      if (!scope.parent_)
        maybeFreeze(scope, result);
    }
    if (scope.patches_) {
      getPlugin("Patches").generateReplacementPatches_(
        baseDraft[DRAFT_STATE].base_,
        result,
        scope.patches_,
        scope.inversePatches_
      );
    }
  } else {
    result = finalize(scope, baseDraft, []);
  }
  revokeScope(scope);
  if (scope.patches_) {
    scope.patchListener_(scope.patches_, scope.inversePatches_);
  }
  return result !== NOTHING ? result : void 0;
}
function finalize(rootScope, value, path) {
  if (isFrozen(value))
    return value;
  const useStrictIteration = rootScope.immer_.shouldUseStrictIteration();
  const state = value[DRAFT_STATE];
  if (!state) {
    each(
      value,
      (key, childValue) => finalizeProperty(rootScope, state, value, key, childValue, path),
      useStrictIteration
    );
    return value;
  }
  if (state.scope_ !== rootScope)
    return value;
  if (!state.modified_) {
    maybeFreeze(rootScope, state.base_, true);
    return state.base_;
  }
  if (!state.finalized_) {
    state.finalized_ = true;
    state.scope_.unfinalizedDrafts_--;
    const result = state.copy_;
    let resultEach = result;
    let isSet2 = false;
    if (state.type_ === 3) {
      resultEach = new Set(result);
      result.clear();
      isSet2 = true;
    }
    each(
      resultEach,
      (key, childValue) => finalizeProperty(
        rootScope,
        state,
        result,
        key,
        childValue,
        path,
        isSet2
      ),
      useStrictIteration
    );
    maybeFreeze(rootScope, result, false);
    if (path && rootScope.patches_) {
      getPlugin("Patches").generatePatches_(
        state,
        path,
        rootScope.patches_,
        rootScope.inversePatches_
      );
    }
  }
  return state.copy_;
}
function finalizeProperty(rootScope, parentState, targetObject, prop, childValue, rootPath, targetIsSet) {
  if (childValue == null) {
    return;
  }
  if (typeof childValue !== "object" && !targetIsSet) {
    return;
  }
  const childIsFrozen = isFrozen(childValue);
  if (childIsFrozen && !targetIsSet) {
    return;
  }
  if (childValue === targetObject)
    die(5);
  if (isDraft(childValue)) {
    const path = rootPath && parentState && parentState.type_ !== 3 && // Set objects are atomic since they have no keys.
    !has(parentState.assigned_, prop) ? rootPath.concat(prop) : void 0;
    const res = finalize(rootScope, childValue, path);
    set(targetObject, prop, res);
    if (isDraft(res)) {
      rootScope.canAutoFreeze_ = false;
    } else
      return;
  } else if (targetIsSet) {
    targetObject.add(childValue);
  }
  if (isDraftable(childValue) && !childIsFrozen) {
    if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) {
      return;
    }
    if (parentState && parentState.base_ && parentState.base_[prop] === childValue && childIsFrozen) {
      return;
    }
    finalize(rootScope, childValue);
    if ((!parentState || !parentState.scope_.parent_) && typeof prop !== "symbol" && (isMap(targetObject) ? targetObject.has(prop) : Object.prototype.propertyIsEnumerable.call(targetObject, prop)))
      maybeFreeze(rootScope, childValue);
  }
}
function maybeFreeze(scope, value, deep = false) {
  if (!scope.parent_ && scope.immer_.autoFreeze_ && scope.canAutoFreeze_) {
    freeze(value, deep);
  }
}
function createProxyProxy(base, parent) {
  const isArray = Array.isArray(base);
  const state = {
    type_: isArray ? 1 : 0,
    // Track which produce call this is associated with.
    scope_: parent ? parent.scope_ : getCurrentScope(),
    // True for both shallow and deep changes.
    modified_: false,
    // Used during finalization.
    finalized_: false,
    // Track which properties have been assigned (true) or deleted (false).
    assigned_: {},
    // The parent draft state.
    parent_: parent,
    // The base state.
    base_: base,
    // The base proxy.
    draft_: null,
    // set below
    // The base copy with any updated values.
    copy_: null,
    // Called by the `produce` function.
    revoke_: null,
    isManual_: false
  };
  let target = state;
  let traps = objectTraps;
  if (isArray) {
    target = [state];
    traps = arrayTraps;
  }
  const { revoke, proxy } = Proxy.revocable(target, traps);
  state.draft_ = proxy;
  state.revoke_ = revoke;
  return proxy;
}
var objectTraps = {
  get(state, prop) {
    if (prop === DRAFT_STATE)
      return state;
    const source = latest(state);
    if (!has(source, prop)) {
      return readPropFromProto(state, source, prop);
    }
    const value = source[prop];
    if (state.finalized_ || !isDraftable(value)) {
      return value;
    }
    if (value === peek(state.base_, prop)) {
      prepareCopy(state);
      return state.copy_[prop] = createProxy(value, state);
    }
    return value;
  },
  has(state, prop) {
    return prop in latest(state);
  },
  ownKeys(state) {
    return Reflect.ownKeys(latest(state));
  },
  set(state, prop, value) {
    const desc = getDescriptorFromProto(latest(state), prop);
    if (desc?.set) {
      desc.set.call(state.draft_, value);
      return true;
    }
    if (!state.modified_) {
      const current2 = peek(latest(state), prop);
      const currentState = current2?.[DRAFT_STATE];
      if (currentState && currentState.base_ === value) {
        state.copy_[prop] = value;
        state.assigned_[prop] = false;
        return true;
      }
      if (is(value, current2) && (value !== void 0 || has(state.base_, prop)))
        return true;
      prepareCopy(state);
      markChanged(state);
    }
    if (state.copy_[prop] === value && // special case: handle new props with value 'undefined'
    (value !== void 0 || prop in state.copy_) || // special case: NaN
    Number.isNaN(value) && Number.isNaN(state.copy_[prop]))
      return true;
    state.copy_[prop] = value;
    state.assigned_[prop] = true;
    return true;
  },
  deleteProperty(state, prop) {
    if (peek(state.base_, prop) !== void 0 || prop in state.base_) {
      state.assigned_[prop] = false;
      prepareCopy(state);
      markChanged(state);
    } else {
      delete state.assigned_[prop];
    }
    if (state.copy_) {
      delete state.copy_[prop];
    }
    return true;
  },
  // Note: We never coerce `desc.value` into an Immer draft, because we can't make
  // the same guarantee in ES5 mode.
  getOwnPropertyDescriptor(state, prop) {
    const owner = latest(state);
    const desc = Reflect.getOwnPropertyDescriptor(owner, prop);
    if (!desc)
      return desc;
    return {
      writable: true,
      configurable: state.type_ !== 1 || prop !== "length",
      enumerable: desc.enumerable,
      value: owner[prop]
    };
  },
  defineProperty() {
    die(11);
  },
  getPrototypeOf(state) {
    return getPrototypeOf(state.base_);
  },
  setPrototypeOf() {
    die(12);
  }
};
var arrayTraps = {};
each(objectTraps, (key, fn) => {
  arrayTraps[key] = function() {
    arguments[0] = arguments[0][0];
    return fn.apply(this, arguments);
  };
});
arrayTraps.deleteProperty = function(state, prop) {
  if (isNaN(parseInt(prop)))
    die(13);
  return arrayTraps.set.call(this, state, prop, void 0);
};
arrayTraps.set = function(state, prop, value) {
  if (prop !== "length" && isNaN(parseInt(prop)))
    die(14);
  return objectTraps.set.call(this, state[0], prop, value, state[0]);
};
function peek(draft, prop) {
  const state = draft[DRAFT_STATE];
  const source = state ? latest(state) : draft;
  return source[prop];
}
function readPropFromProto(state, source, prop) {
  const desc = getDescriptorFromProto(source, prop);
  return desc ? `value` in desc ? desc.value : (
    // This is a very special case, if the prop is a getter defined by the
    // prototype, we should invoke it with the draft as context!
    desc.get?.call(state.draft_)
  ) : void 0;
}
function getDescriptorFromProto(source, prop) {
  if (!(prop in source))
    return void 0;
  let proto = getPrototypeOf(source);
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (desc)
      return desc;
    proto = getPrototypeOf(proto);
  }
  return void 0;
}
function markChanged(state) {
  if (!state.modified_) {
    state.modified_ = true;
    if (state.parent_) {
      markChanged(state.parent_);
    }
  }
}
function prepareCopy(state) {
  if (!state.copy_) {
    state.copy_ = shallowCopy(
      state.base_,
      state.scope_.immer_.useStrictShallowCopy_
    );
  }
}
var Immer2 = class {
  constructor(config) {
    this.autoFreeze_ = true;
    this.useStrictShallowCopy_ = false;
    this.useStrictIteration_ = true;
    this.produce = (base, recipe, patchListener) => {
      if (typeof base === "function" && typeof recipe !== "function") {
        const defaultBase = recipe;
        recipe = base;
        const self = this;
        return function curriedProduce(base2 = defaultBase, ...args) {
          return self.produce(base2, (draft) => recipe.call(this, draft, ...args));
        };
      }
      if (typeof recipe !== "function")
        die(6);
      if (patchListener !== void 0 && typeof patchListener !== "function")
        die(7);
      let result;
      if (isDraftable(base)) {
        const scope = enterScope(this);
        const proxy = createProxy(base, void 0);
        let hasError = true;
        try {
          result = recipe(proxy);
          hasError = false;
        } finally {
          if (hasError)
            revokeScope(scope);
          else
            leaveScope(scope);
        }
        usePatchesInScope(scope, patchListener);
        return processResult(result, scope);
      } else if (!base || typeof base !== "object") {
        result = recipe(base);
        if (result === void 0)
          result = base;
        if (result === NOTHING)
          result = void 0;
        if (this.autoFreeze_)
          freeze(result, true);
        if (patchListener) {
          const p = [];
          const ip = [];
          getPlugin("Patches").generateReplacementPatches_(base, result, p, ip);
          patchListener(p, ip);
        }
        return result;
      } else
        die(1, base);
    };
    this.produceWithPatches = (base, recipe) => {
      if (typeof base === "function") {
        return (state, ...args) => this.produceWithPatches(state, (draft) => base(draft, ...args));
      }
      let patches, inversePatches;
      const result = this.produce(base, recipe, (p, ip) => {
        patches = p;
        inversePatches = ip;
      });
      return [result, patches, inversePatches];
    };
    if (typeof config?.autoFreeze === "boolean")
      this.setAutoFreeze(config.autoFreeze);
    if (typeof config?.useStrictShallowCopy === "boolean")
      this.setUseStrictShallowCopy(config.useStrictShallowCopy);
    if (typeof config?.useStrictIteration === "boolean")
      this.setUseStrictIteration(config.useStrictIteration);
  }
  createDraft(base) {
    if (!isDraftable(base))
      die(8);
    if (isDraft(base))
      base = current(base);
    const scope = enterScope(this);
    const proxy = createProxy(base, void 0);
    proxy[DRAFT_STATE].isManual_ = true;
    leaveScope(scope);
    return proxy;
  }
  finishDraft(draft, patchListener) {
    const state = draft && draft[DRAFT_STATE];
    if (!state || !state.isManual_)
      die(9);
    const { scope_: scope } = state;
    usePatchesInScope(scope, patchListener);
    return processResult(void 0, scope);
  }
  /**
   * Pass true to automatically freeze all copies created by Immer.
   *
   * By default, auto-freezing is enabled.
   */
  setAutoFreeze(value) {
    this.autoFreeze_ = value;
  }
  /**
   * Pass true to enable strict shallow copy.
   *
   * By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
   */
  setUseStrictShallowCopy(value) {
    this.useStrictShallowCopy_ = value;
  }
  /**
   * Pass false to use faster iteration that skips non-enumerable properties
   * but still handles symbols for compatibility.
   *
   * By default, strict iteration is enabled (includes all own properties).
   */
  setUseStrictIteration(value) {
    this.useStrictIteration_ = value;
  }
  shouldUseStrictIteration() {
    return this.useStrictIteration_;
  }
  applyPatches(base, patches) {
    let i;
    for (i = patches.length - 1; i >= 0; i--) {
      const patch = patches[i];
      if (patch.path.length === 0 && patch.op === "replace") {
        base = patch.value;
        break;
      }
    }
    if (i > -1) {
      patches = patches.slice(i + 1);
    }
    const applyPatchesImpl = getPlugin("Patches").applyPatches_;
    if (isDraft(base)) {
      return applyPatchesImpl(base, patches);
    }
    return this.produce(
      base,
      (draft) => applyPatchesImpl(draft, patches)
    );
  }
};
function createProxy(value, parent) {
  const draft = isMap(value) ? getPlugin("MapSet").proxyMap_(value, parent) : isSet(value) ? getPlugin("MapSet").proxySet_(value, parent) : createProxyProxy(value, parent);
  const scope = parent ? parent.scope_ : getCurrentScope();
  scope.drafts_.push(draft);
  return draft;
}
function current(value) {
  if (!isDraft(value))
    die(10, value);
  return currentImpl(value);
}
function currentImpl(value) {
  if (!isDraftable(value) || isFrozen(value))
    return value;
  const state = value[DRAFT_STATE];
  let copy;
  let strict = true;
  if (state) {
    if (!state.modified_)
      return state.base_;
    state.finalized_ = true;
    copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_);
    strict = state.scope_.immer_.shouldUseStrictIteration();
  } else {
    copy = shallowCopy(value, true);
  }
  each(
    copy,
    (key, childValue) => {
      set(copy, key, currentImpl(childValue));
    },
    strict
  );
  if (state) {
    state.finalized_ = false;
  }
  return copy;
}
var immer = new Immer2();
var produce = immer.produce;

function notifySubscribers(listeners, label, ...args) {
  for (const listener of [...listeners]) try {
    listener(...args);
  } catch (error) {
    console.error(`${label} subscriber failed:`, error);
  }
}
function rafBatch(notify) {
  const schedule = typeof requestAnimationFrame === "function" ? (fn) => {
    requestAnimationFrame(() => {
      fn();
    });
  } : (fn) => {
    queueMicrotask(fn);
  };
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      notify();
    });
  };
}
function createSnapshotStore(init, opts) {
  const withSelector = subscribeWithSelector(() => init);
  const api = createStore()(withSelector);
  if (opts?.persist) attachPersistence(api, opts.persist.name);
  let subscribe = (fn) => api.subscribe(() => {
    notifySubscribers([fn], "[client-store]");
  });
  if (opts?.flush === "raf") {
    const listeners = /* @__PURE__ */ new Set();
    const flush = rafBatch(() => {
      notifySubscribers(listeners, "[client-store]");
    });
    api.subscribe(flush);
    subscribe = (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    };
  }
  return {
    getSnapshot: () => api.getState(),
    subscribe: (fn) => subscribe(fn),
    update: (mutator) => {
      api.setState(produce(api.getState(), (draft) => {
        mutator(draft);
      }), true);
    },
    set: (next) => {
      api.setState(devFreeze(next), true);
    }
  };
}
function attachPersistence(api, name) {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(name);
    if (raw !== null) api.setState(devFreeze(JSON.parse(raw)), true);
  } catch (error) {
    console.error(`snapshot store '${name}' rehydration failed:`, error);
  }
  api.subscribe((state) => {
    try {
      localStorage.setItem(name, JSON.stringify(state));
    } catch (error) {
      console.error(`snapshot store '${name}' persistence failed:`, error);
    }
  });
}
function devFreeze(value) {
  return freeze(value, true);
}

// src/client/MatlabMcpSettingsCard.tsx
var import_jsx_runtime = require("react/jsx-runtime");
async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  let parsed;
  try {
    parsed = await response.json();
  } catch {
    parsed = void 0;
  }
  return { response, ...parsed === void 0 ? {} : { body: parsed } };
}
function failureMessage(payload, status) {
  const code = typeof payload?.error === "string" ? payload.error : void 0;
  const message = typeof payload?.message === "string" ? payload.message : void 0;
  return [code, message].filter((part) => part !== void 0 && part !== "").join(" \u2014 ") || "HTTP " + status;
}
var MatlabMcpSettingsCardController = class {
  constructor(scope) {
    this.scope = scope;
    this.disposeScope = scope.subscribe(() => {
      this.sync();
    });
    this.sync();
  }
  store = createSnapshotStore({ status: "loading", writable: false });
  disposeScope;
  sync() {
    const snapshot = this.scope.getSnapshot();
    this.store.set({
      status: snapshot.status,
      config: snapshot.value,
      writable: snapshot.writable
    });
  }
  inject() {
    return {
      hooks: { matlabMcpSettingsCard: this.store },
      save: async (draft) => {
        await this.save(draft);
      },
      resetAll: async () => {
        await this.resetAll();
      },
      testConnection: async (deep) => await this.testConnection(deep),
      install: async () => await this.install(),
      refreshStatus: async () => await this.refreshStatus(),
      testMirrors: async () => await this.testMirrors(),
      reconnect: async () => {
        await this.reconnect();
      }
    };
  }
  dispose() {
    this.disposeScope();
  }
  async save(draft) {
    for (const [field, value] of Object.entries(draft)) {
      if (value === void 0 || value === null || value === "") {
        await this.scope.unset(field);
      } else {
        await this.scope.set(field, value);
      }
    }
  }
  async resetAll() {
    const snapshot = this.scope.getSnapshot();
    const user = snapshot.user;
    if (user === void 0) return;
    for (const field of Object.keys(user)) {
      await this.scope.unset(field);
    }
  }
  async testConnection(deep) {
    const { response, body } = await postJson("/api/dsh-matlab-mcp/test", { deep });
    if (!response.ok || body?.ok !== true) throw new Error(failureMessage(body, response.status));
    return body.result === void 0 ? void 0 : { ...body.result.callText === void 0 ? {} : { callText: body.result.callText } };
  }
  async install() {
    const { response, body } = await postJson("/api/dsh-matlab-mcp/setup", {});
    if (!response.ok || body?.ok !== true) {
      const logs = body?.logs ?? [];
      const detail = failureMessage(body, response.status);
      throw new Error(logs.length === 0 ? detail : detail + "\n" + logs.slice(-6).join("\n"));
    }
    return body.logs ?? [];
  }
  async testMirrors() {
    const { response, body } = await postJson("/api/dsh-matlab-mcp/mirrors/test", {});
    if (!response.ok || body?.ok !== true) throw new Error(failureMessage(body, response.status));
    return { results: body.results ?? [], ordered: body.ordered ?? [] };
  }
  async refreshStatus() {
    const { response, body } = await postJson("/api/dsh-matlab-mcp/status", {});
    if (!response.ok || body?.ok !== true) return void 0;
    return body.state;
  }
  async reconnect() {
    const { response, body } = await postJson("/api/dsh-matlab-mcp/reconnect", {});
    if (!response.ok || body?.ok !== true) throw new Error(failureMessage(body, response.status));
  }
};
var cardStyle = {
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-alias-bg-layer-3)",
  borderRadius: 12,
  color: "var(--dsw-alias-label-primary)"
};
var headerStyle = { display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px" };
var titleStyle = { margin: 0, color: "var(--dsw-alias-label-primary)", fontSize: 15, fontWeight: 600, lineHeight: 1.4 };
var descriptionStyle = { margin: "4px 0 0", color: "var(--dsw-alias-label-tertiary)", fontSize: 13, lineHeight: 1.5 };
var bodyStyle = { borderTop: "1px solid var(--dsw-alias-border-l2)", margin: "0 16px", padding: "8px 0 12px" };
var footerStyle = {
  borderTop: "1px solid var(--dsw-alias-border-l2)",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
  margin: "0 16px",
  padding: "12px 0 16px"
};
var fieldStyle = { display: "flex", flexDirection: "column", gap: 6, padding: "10px 0" };
var labelStyle = { color: "var(--dsw-alias-label-primary)", fontSize: 13, fontWeight: 500, lineHeight: 1.5 };
var hintStyle = { color: "var(--dsw-alias-label-tertiary)", fontSize: 12, lineHeight: 1.5 };
var inputStyle = {
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-alias-bg-layer-3)",
  color: "var(--dsw-alias-label-primary)",
  borderRadius: 8,
  padding: "0 12px",
  height: 34,
  fontSize: 13,
  lineHeight: 1.5,
  width: "100%",
  boxSizing: "border-box",
  font: "inherit"
};
var buttonBaseStyle = {
  appearance: "none",
  font: "inherit",
  cursor: "pointer",
  border: "1px solid transparent",
  borderRadius: 8,
  padding: "6px 16px",
  fontSize: 13,
  lineHeight: 1.5
};
var primaryButtonStyle = { ...buttonBaseStyle, background: "var(--dsw-alias-label-primary)", color: "var(--dsw-alias-bg-layer-3)" };
var secondaryButtonStyle = { ...buttonBaseStyle, borderColor: "var(--dsw-alias-border-l2)", background: "transparent", color: "var(--dsw-alias-label-secondary)" };
var disabledButtonStyle = { opacity: 0.4, cursor: "default" };
var preStyle = {
  margin: "8px 0 0",
  padding: 10,
  borderRadius: 8,
  background: "var(--dsw-alias-bg-layer-2)",
  color: "var(--dsw-alias-label-secondary)",
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  maxHeight: 180,
  overflow: "auto"
};
var statusRowStyle = { display: "flex", gap: 8, alignItems: "baseline", fontSize: 12, lineHeight: 1.6, color: "var(--dsw-alias-label-secondary)" };
var badgeStyle = {
  display: "inline-block",
  padding: "0 8px",
  borderRadius: 999,
  fontSize: 11,
  lineHeight: "18px",
  border: "1px solid var(--dsw-alias-border-l2)"
};
function Field(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: fieldStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: labelStyle, children: props.label }),
    props.children,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: hintStyle, children: props.hint })
  ] });
}
function TextField(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: props.label, hint: props.hint, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "text", value: props.value ?? "", disabled: props.disabled, onChange: (event) => {
    props.onChange(event.target.value);
  }, style: inputStyle }) });
}
function NumberField(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: props.label, hint: props.hint, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "input",
    {
      type: "number",
      value: props.value ?? "",
      disabled: props.disabled,
      onChange: (event) => {
        const text = event.target.value.trim();
        if (text === "") return props.onChange(void 0);
        const parsed = Number(text);
        props.onChange(Number.isFinite(parsed) ? parsed : void 0);
      },
      style: inputStyle
    }
  ) });
}
function SelectField(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: props.label, hint: props.hint, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: props.value, disabled: props.disabled, onChange: (event) => {
    props.onChange(event.target.value);
  }, style: inputStyle, children: props.options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: option.value, children: option.label }, option.value)) }) });
}
function BooleanField(props) {
  const trackStyle = {
    appearance: "none",
    font: "inherit",
    position: "relative",
    flex: "0 0 auto",
    width: 36,
    height: 20,
    padding: 0,
    border: "1px solid " + (props.value ? "transparent" : "var(--dsw-alias-border-l2)"),
    borderRadius: 999,
    background: props.value ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-layer-2)",
    cursor: props.disabled ? "default" : "pointer",
    opacity: props.disabled ? 0.4 : 1,
    transition: "background 120ms ease, border-color 120ms ease"
  };
  const thumbStyle = {
    position: "absolute",
    top: 2,
    left: props.value ? 18 : 2,
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
    transition: "left 120ms ease"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { label: props.label, hint: props.hint, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        role: "switch",
        "aria-checked": props.value,
        "aria-label": props.label,
        disabled: props.disabled,
        onClick: () => {
          props.onChange(!props.value);
        },
        style: trackStyle,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", style: thumbStyle })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 12, lineHeight: 1.5 }, children: props.value ? "\u5F00 / on" : "\u5173 / off" })
  ] }) });
}
function MatlabMcpSettingsCard(props) {
  const { t } = props;
  const state = props.useMatlabMcpSettingsCard((snapshot) => snapshot);
  const [draft, setDraft] = (0, import_react.useState)({});
  const [seeded, setSeeded] = (0, import_react.useState)(false);
  const [busy, setBusy] = (0, import_react.useState)();
  const [notice, setNotice] = (0, import_react.useState)();
  const [status, setStatus] = (0, import_react.useState)();
  const [statusLoading, setStatusLoading] = (0, import_react.useState)(true);
  const [mirrors, setMirrors] = (0, import_react.useState)([]);
  const [mirrorOrder, setMirrorOrder] = (0, import_react.useState)([]);
  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      setStatus(await props.refreshStatus());
    } finally {
      setStatusLoading(false);
    }
  };
  (0, import_react.useEffect)(() => {
    if (!seeded && state.status === "ready") {
      setDraft(state.config ?? {});
      setSeeded(true);
    }
  }, [seeded, state.status, state.config]);
  (0, import_react.useEffect)(() => {
    void loadStatus();
  }, []);
  if (state.status === "loading") return null;
  const disabled = !state.writable || busy !== void 0;
  const update = (field, value) => {
    setDraft((current2) => ({ ...current2, [field]: value }));
    setNotice(void 0);
  };
  const guard = async (kind, action) => {
    setBusy(kind);
    setNotice(void 0);
    try {
      await action();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(void 0);
    }
  };
  const onSave = () => guard("save", async () => {
    await props.save(draft);
    setNotice({ kind: "ok", text: t("settings.saved") });
  });
  const onReset = () => guard("save", async () => {
    await props.resetAll();
    setDraft(state.config ?? {});
    setNotice({ kind: "ok", text: t("settings.saved") });
  });
  const onTest = (deep) => guard(deep ? "deep" : "test", async () => {
    await props.save(draft);
    const result = await props.testConnection(deep);
    setNotice({
      kind: "ok",
      text: deep ? t("settings.deepTestOk") + (result?.callText === void 0 ? "" : " \u2014 " + result.callText.split("\n").filter((line) => line.trim() !== "").join(" | ")) : t("settings.testOk")
    });
    await loadStatus();
  });
  const onInstall = () => guard("setup", async () => {
    await props.save(draft);
    const logs = await props.install();
    await props.reconnect();
    setNotice({ kind: "ok", text: t("settings.setupOk") + (logs.length === 0 ? "" : " \u2014 " + logs.slice(-2).join(" | ")) });
    await loadStatus();
  });
  const onTestMirrors = () => guard("mirrors", async () => {
    await props.save(draft);
    const measured = await props.testMirrors();
    setMirrors(measured.results);
    setMirrorOrder(measured.ordered);
    const best = measured.results.filter((entry) => entry.ok).sort((left, right) => (right.mbps ?? 0) - (left.mbps ?? 0))[0];
    setNotice({ kind: "ok", text: t("settings.mirrorTestOk") + (best === void 0 ? "" : " \u2014 " + best.template + " " + (best.mbps ?? 0).toFixed(2) + " MB/s") });
  });
  const onApplyFastestMirrors = () => guard("save", async () => {
    const ordered = mirrorOrder.length > 0 ? mirrorOrder : mirrors.filter((entry) => entry.ok).sort((left, right) => (right.mbps ?? 0) - (left.mbps ?? 0)).map((entry) => entry.template);
    if (ordered.length === 0) return;
    const next = { ...draft, downloadMirror: ordered.join(",") };
    setDraft(next);
    await props.save(next);
    setNotice({ kind: "ok", text: t("settings.mirrorApplied") });
  });
  const onReconnect = () => guard("reconnect", async () => {
    await props.save(draft);
    await props.reconnect();
    setNotice({ kind: "ok", text: t("settings.reconnectOk") });
    await loadStatus();
  });
  const noticeStyle = {
    margin: "8px 0 0",
    fontSize: 12,
    lineHeight: 1.5,
    flex: "1 1 100%",
    color: notice?.kind === "ok" ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-label-error)",
    whiteSpace: "pre-wrap"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: cardStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", { style: headerStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: titleStyle, children: t("settings.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: descriptionStyle, children: t("settings.description") })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: bodyStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...statusRowStyle, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: t("settings.status") }),
        statusLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("settings.statusLoading") }) : status === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("settings.statusUnavailable") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: badgeStyle, children: status.ready ? t("settings.statusReady") : t("settings.statusNotReady") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            "MCP: ",
            status.binary.present ? "v" + (status.binary.version ?? "?") : "\u2717"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            "toolbox: ",
            status.toolbox.present ? "\u2713" : "\u2717"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            "toolkits: ",
            status.toolkits.every((toolkit) => toolkit.present) ? "\u2713" : "\u2717"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
            "MATLAB: ",
            status.matlab.root ?? t("settings.noMatlab")
          ] })
        ] })
      ] }),
      status !== void 0 && status.matlab.candidates.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: statusRowStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        t("settings.candidates"),
        ": ",
        status.matlab.candidates.join(" | ")
      ] }) }) : null,
      status !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: statusRowStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: status.home }) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { ...hintStyle, margin: "6px 0 0" }, children: t("settings.installHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooleanField, { label: t("settings.enabled"), hint: t("settings.enabledHint"), value: draft.enabled ?? true, disabled, onChange: (value) => {
        update("enabled", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooleanField, { label: t("settings.announceToAgent"), hint: t("settings.announceToAgentHint"), value: draft.announceToAgent ?? true, disabled, onChange: (value) => {
        update("announceToAgent", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, { label: t("settings.matlabRoot"), hint: t("settings.matlabRootHint"), value: draft.matlabRoot, disabled, onChange: (value) => {
        update("matlabRoot", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        SelectField,
        {
          label: t("settings.sessionMode"),
          hint: t("settings.sessionModeHint"),
          value: draft.sessionMode ?? "new",
          disabled,
          options: [
            { value: "new", label: t("settings.sessionModeNew") },
            { value: "auto", label: t("settings.sessionModeAuto") },
            { value: "existing", label: t("settings.sessionModeExisting") }
          ],
          onChange: (value) => {
            update("sessionMode", value);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        SelectField,
        {
          label: t("settings.displayMode"),
          hint: t("settings.displayModeHint"),
          value: draft.displayMode ?? "desktop",
          disabled,
          options: [
            { value: "desktop", label: t("settings.displayModeDesktop") },
            { value: "nodesktop", label: t("settings.displayModeNodesktop") }
          ],
          onChange: (value) => {
            update("displayMode", value);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, { label: t("settings.initialWorkingFolder"), hint: t("settings.initialWorkingFolderHint"), value: draft.initialWorkingFolder, disabled, onChange: (value) => {
        update("initialWorkingFolder", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooleanField, { label: t("settings.simulinkTools"), hint: t("settings.simulinkToolsHint"), value: draft.simulinkTools ?? true, disabled, onChange: (value) => {
        update("simulinkTools", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooleanField, { label: t("settings.skillsEnabled"), hint: t("settings.skillsEnabledHint"), value: draft.skillsEnabled ?? true, disabled, onChange: (value) => {
        update("skillsEnabled", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, { label: t("settings.skillGroups"), hint: t("settings.skillGroupsHint"), value: draft.skillGroups, disabled, onChange: (value) => {
        update("skillGroups", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, { label: t("settings.toolCallTimeoutMs"), hint: t("settings.toolCallTimeoutMsHint"), value: draft.toolCallTimeoutMs, disabled, onChange: (value) => {
        update("toolCallTimeoutMs", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooleanField, { label: t("settings.allowMirrorDownload"), hint: t("settings.allowMirrorDownloadHint"), value: draft.allowMirrorDownload ?? false, disabled, onChange: (value) => {
        update("allowMirrorDownload", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, { label: t("settings.downloadMirror"), hint: t("settings.downloadMirrorHint"), value: draft.downloadMirror, disabled, onChange: (value) => {
        update("downloadMirror", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, { label: t("settings.mirrorTest"), hint: t("settings.mirrorTestHint"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              disabled,
              style: disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle,
              onClick: () => {
                void onTestMirrors();
              },
              children: t(busy === "mirrors" ? "settings.mirrorTesting" : "settings.mirrorTestRun")
            }
          ),
          mirrors.some((entry) => entry.ok) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              disabled,
              style: disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle,
              onClick: () => {
                void onApplyFastestMirrors();
              },
              children: t("settings.mirrorApplyFastest")
            }
          ) : null
        ] }),
        mirrors.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: preStyle, children: mirrors.map((entry) => entry.ok ? `${(entry.mbps ?? 0).toFixed(2)} MB/s  ${entry.ttfbMs === void 0 ? "" : entry.ttfbMs + " ms  "}${entry.template}` : `\u2717            ${entry.template}  (${entry.note ?? "failed"})`).join("\n") }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooleanField, { label: t("settings.telemetry"), hint: t("settings.telemetryHint"), value: draft.telemetry ?? false, disabled, onChange: (value) => {
        update("telemetry", value);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BooleanField, { label: t("settings.shutdownMatlabOnUnload"), hint: t("settings.shutdownMatlabOnUnloadHint"), value: draft.shutdownMatlabOnUnload ?? true, disabled, onChange: (value) => {
        update("shutdownMatlabOnUnload", value);
      } })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { style: footerStyle, children: [
      notice !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: noticeStyle, role: "status", children: notice.text }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled, style: disabled ? { ...primaryButtonStyle, ...disabledButtonStyle } : primaryButtonStyle, onClick: () => {
        void onSave();
      }, children: t(busy === "save" ? "settings.saving" : "settings.save") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled, style: disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle, onClick: () => {
        void onInstall();
      }, children: t(busy === "setup" ? "settings.settingUp" : "settings.setup") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled, style: disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle, onClick: () => {
        void onTest(false);
      }, children: t(busy === "test" ? "settings.testingConnection" : "settings.testConnection") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled, style: disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle, onClick: () => {
        void onTest(true);
      }, children: t(busy === "deep" ? "settings.deepTesting" : "settings.deepTest") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled, style: disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle, onClick: () => {
        void onReconnect();
      }, children: t(busy === "reconnect" ? "settings.reconnecting" : "settings.reconnect") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: disabled || statusLoading, style: disabled || statusLoading ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle, onClick: () => {
        void loadStatus();
      }, children: t("settings.refreshStatus") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled, style: disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle, onClick: () => {
        void onReset();
      }, children: t("settings.resetAll") })
    ] }),
    notice?.kind === "error" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: preStyle, children: notice.text }) : null
  ] });
}

// src/client/MatlabOpenButton.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var MatlabOpenController = class {
  inject() {
    return { open: async () => await this.open() };
  }
  async open() {
    const response = await fetch("/api/dsh-matlab-mcp/open-matlab", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    let body;
    try {
      body = await response.json();
    } catch {
      body = void 0;
    }
    if (!response.ok || body?.ok !== true || body.result === void 0) {
      throw new Error([body?.error, body?.message].filter((part) => typeof part === "string" && part !== "").join(" \u2014 ") || "HTTP " + response.status);
    }
    return body.result;
  }
};
var buttonStyle = {
  appearance: "none",
  font: "inherit",
  cursor: "pointer",
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "transparent",
  color: "var(--dsw-alias-label-secondary)",
  borderRadius: 8,
  padding: "4px 10px",
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: "nowrap"
};
function MatlabOpenButton(props) {
  const { t } = props;
  const [state, setState] = (0, import_react2.useState)("idle");
  const [detail, setDetail] = (0, import_react2.useState)();
  const onClick = async () => {
    setState("busy");
    setDetail(void 0);
    try {
      const result = await props.open();
      setState("ok");
      setDetail(result.message);
      window.setTimeout(() => {
        setState("idle");
      }, 8e3);
    } catch (error) {
      setState("error");
      setDetail(error instanceof Error ? error.message : String(error));
    }
  };
  const label = state === "busy" ? t("button.opening") : state === "ok" ? t("button.opened") : t("button.openMatlab");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "button",
    {
      type: "button",
      title: detail ?? t("button.openMatlabHint"),
      disabled: state === "busy",
      onClick: () => {
        void onClick();
      },
      style: state === "error" ? { ...buttonStyle, color: "var(--dsw-alias-label-error)" } : state === "busy" ? { ...buttonStyle, opacity: 0.6 } : buttonStyle,
      children: label
    }
  );
}

// src/client/settings-scope.ts
var NS = "matlab-mcp";
var API = {
  describe: "/api/dsh-matlab-mcp/settings/describe",
  mutate: "/api/dsh-matlab-mcp/settings/mutate"
};
function createMatlabMcpSettingsScope() {
  const store = createSnapshotStore({
    status: "loading",
    value: void 0,
    base: void 0,
    user: void 0,
    revision: void 0,
    writable: false,
    mode: "host"
  });
  let tail = Promise.resolve();
  let disposed = false;
  const post = async (path, body) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.json();
  };
  const read = async () => {
    if (disposed) return;
    try {
      const body = await post(API.describe, {});
      if (body.ok !== true || body.value === void 0) throw new Error("settings bridge unavailable");
      const view = body.value.namespaces.find((candidate) => candidate.ns === NS);
      if (view === void 0) throw new Error(NS + " settings namespace not exposed");
      accept(view, body.value.writable);
    } catch {
      if (!disposed) store.update((draft) => {
        draft.status = "unavailable";
      });
    }
  };
  const accept = (view, writable) => {
    if (disposed) return;
    store.set({
      status: "ready",
      value: view.value,
      base: view.base,
      user: view.user,
      revision: view.revision,
      writable,
      mode: "host"
    });
  };
  const write = async (ops, expectedRevision) => {
    if (disposed) return;
    const revision = expectedRevision ?? store.getSnapshot().revision;
    try {
      const body = await post(API.mutate, {
        ns: NS,
        ops,
        ...revision === void 0 ? {} : { expectedRevision: revision }
      });
      if (body.ok !== true || body.value === void 0) {
        await read();
        throw new Error(body.message ?? body.code ?? "settings write failed");
      }
      accept(body.value, store.getSnapshot().writable);
    } catch {
      await read().catch(() => {
      });
      throw new Error("settings write failed");
    }
  };
  const enqueue = (operation) => {
    if (disposed) return Promise.resolve();
    const task = tail.then(operation, operation);
    tail = task.catch(() => {
    });
    return task;
  };
  void read();
  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: (listener) => store.subscribe(listener),
    mutate: (ops, expectedRevision) => enqueue(() => write(
      ops.map((op) => op.op === "set" ? { op: "set", path: [...op.path], value: op.value } : { op: "unset", path: [...op.path] }),
      expectedRevision
    )),
    set: (field, value) => enqueue(() => write([{ op: "set", path: [field], value }])),
    unset: (field) => enqueue(() => write([{ op: "unset", path: [field] }]))
  };
}

// src/client/locales.ts
var zh = {
  "settings.title": "MATLAB / Simulink MCP",
  "settings.description": "\u901A\u8FC7 MathWorks \u5B98\u65B9 MATLAB MCP Server \u8BA9 DSH \u76F4\u63A5\u6267\u884C MATLAB \u4EE3\u7801\u3001\u8DD1 Simulink \u4EFF\u771F\uFF0C\u5E76\u6CE8\u5165 MATLAB/Simulink Agentic Toolkit \u6280\u80FD\u3002",
  "settings.enabled": "\u542F\u7528\u63D2\u4EF6",
  "settings.enabledHint": "\u5173\u95ED\u540E\u5378\u8F7D MCP \u5BA2\u6237\u7AEF\uFF0C\u4E0D\u518D\u6CE8\u518C mcp__matlab__* \u5DE5\u5177\u3002",
  "settings.announceToAgent": "\u5411 Agent \u516C\u544A\u672C\u63D2\u4EF6",
  "settings.announceToAgentHint": "\u5728\u7CFB\u7EDF\u63D0\u793A\u4E2D\u6CE8\u5165 MATLAB \u4F7F\u7528\u89C4\u8303\uFF08\u8D85\u65F6\u3001\u56FE\u7A97\u5BFC\u51FA\u3001Simulink \u5DE5\u5177\u4F18\u5148\u7EA7\u3001\u6280\u80FD\u52A0\u8F7D\uFF09\u3002",
  "settings.matlabRoot": "MATLAB \u5B89\u88C5\u76EE\u5F55",
  "settings.matlabRootHint": "\u7559\u7A7A = \u81EA\u52A8\u63A2\u6D4B\uFF08\u4F18\u5148\u6700\u65B0\u7248\u672C\uFF0C\u5982 D:\\MATLAB\\2025b\uFF09\u3002",
  "settings.sessionMode": "\u4F1A\u8BDD\u6A21\u5F0F",
  "settings.sessionModeHint": "new\uFF1A\u63D2\u4EF6\u81EA\u5DF1\u542F\u52A8 MATLAB\uFF08\u9ED8\u8BA4\uFF0C\u96F6\u624B\u52A8\uFF09\uFF1Bauto\uFF1A\u4F18\u5148\u63A5\u7BA1\u5DF2\u5171\u4EAB\u7684 MATLAB\uFF0C\u5426\u5219\u65B0\u5F00\uFF1Bexisting\uFF1A\u53EA\u8FDE\u5DF2\u5171\u4EAB\u4F1A\u8BDD\uFF08\u9700\u5148\u5728 MATLAB \u6267\u884C shareMATLABSession\uFF09\u3002",
  "settings.sessionModeNew": "new\uFF08\u81EA\u5DF1\u542F\u52A8\uFF0C\u63A8\u8350\uFF09",
  "settings.sessionModeAuto": "auto\uFF08\u4F18\u5148\u63A5\u7BA1\u5DF2\u6709\u4F1A\u8BDD\uFF09",
  "settings.sessionModeExisting": "existing\uFF08\u53EA\u7528\u5DF2\u5171\u4EAB\u4F1A\u8BDD\uFF09",
  "settings.displayMode": "MATLAB \u663E\u793A\u6A21\u5F0F",
  "settings.displayModeHint": "desktop\uFF1A\u663E\u793A MATLAB \u684C\u9762\u7A97\u53E3\uFF08\u53EF\u89C1\u3001\u4FBF\u4E8E\u89C2\u5BDF\uFF09\uFF1Bnodesktop\uFF1A\u4E0D\u663E\u793A\u684C\u9762\uFF08\u66F4\u5FEB\uFF09\u3002",
  "settings.displayModeDesktop": "desktop\uFF08\u663E\u793A\u684C\u9762\uFF09",
  "settings.displayModeNodesktop": "nodesktop\uFF08\u4E0D\u663E\u793A\u684C\u9762\uFF09",
  "settings.initialWorkingFolder": "MATLAB \u5DE5\u4F5C\u76EE\u5F55",
  "settings.initialWorkingFolderHint": "\u7559\u7A7A = \u4F7F\u7528\u63D2\u4EF6\u7F13\u5B58\u76EE\u5F55\u4E0B\u7684 workspace\u3002",
  "settings.simulinkTools": "\u542F\u7528 Simulink \u5DE5\u5177",
  "settings.simulinkToolsHint": "\u6302\u8F7D Simulink Agentic Toolkit \u7684 9 \u4E2A\u6A21\u578B\u5DE5\u5177\uFF0C\u5E76\u5728\u5B89\u88C5\u65F6\u628A\u5DE5\u5177\u5305\u8DEF\u5F84\u5199\u5165 MATLAB\uFF08addpath + savepath\uFF09\u3002",
  "settings.skillsEnabled": "\u6CE8\u5165 Agentic Toolkit \u6280\u80FD",
  "settings.skillsEnabledHint": "\u628A\u4E24\u4E2A Agentic Toolkit \u7684\u6280\u80FD\u6CE8\u518C\u8FDB\u672C\u4F1A\u8BDD\u7684\u6280\u80FD\u76EE\u5F55\uFF08\u7528 skill \u5DE5\u5177\u6309\u9700\u52A0\u8F7D\uFF09\u3002",
  "settings.skillGroups": "\u542F\u7528\u7684\u6280\u80FD\u7EC4",
  "settings.skillGroupsHint": "\u9017\u53F7\u5206\u9694\uFF1B\u7559\u7A7A = \u4F7F\u7528\u9ED8\u8BA4\u7EC4\uFF08matlab-core\u3001matlab-programming\u3001matlab-software-development\u3001matlab-data-import-and-analysis\u3001model-based-design-core\u3001simulink-simulation\uFF09\uFF1B\u586B none = \u5168\u90E8\u5173\u95ED\u3002",
  "settings.toolCallTimeoutMs": "\u5355\u6B21\u5DE5\u5177\u8C03\u7528\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  "settings.toolCallTimeoutMsHint": "\u9ED8\u8BA4 600000\uFF0810 \u5206\u949F\uFF09\uFF1BMATLAB \u51B7\u542F\u52A8\u7EA6 20\u201345 \u79D2\uFF0C\u4EFF\u771F\u53EF\u80FD\u6570\u5206\u949F\u3002",
  "settings.allowMirrorDownload": "\u5141\u8BB8\u955C\u50CF\u4E0B\u8F7D",
  "settings.allowMirrorDownloadHint": "\u9ED8\u8BA4\u5173\u95ED\u3002\u76F4\u8FDE GitHub \u5931\u8D25\u65F6\u624D\u4F7F\u7528\u955C\u50CF\uFF08\u9ED8\u8BA4\u4E3A ghproxy.net\uFF09\u4E0B\u8F7D MathWorks \u5B98\u65B9\u5236\u54C1\uFF1B\u5173\u95ED\u65F6\u76F4\u8FDE\u5931\u8D25\u4F1A\u62A5\u9519\u5E76\u63D0\u793A\u5F00\u542F\u3002",
  "settings.downloadMirror": "\u955C\u50CF\u5217\u8868\uFF08\u6309\u987A\u5E8F\u5C1D\u8BD5\uFF09",
  "settings.downloadMirrorHint": "\u9017\u53F7\u5206\u9694\uFF0C\u53EF\u5199\u591A\u4E2A\uFF1A\u6309\u987A\u5E8F\u56DE\u9000\u3002\u6A21\u677F\u652F\u6301 {url}\uFF08\u524D\u7F00\u5F0F\uFF0C\u5982 https://gh-proxy.com/{url}\uFF09\u4E0E {path}\uFF08\u6362\u4E3B\u673A\u5F0F\uFF09\u3002\u5F00\u542F\u955C\u50CF\u4E0B\u8F7D\u540E\u4F18\u5148\u8D70\u955C\u50CF\u3001\u76F4\u8FDE\u515C\u5E95\u3002",
  "settings.mirrorTest": "\u955C\u50CF\u6D4B\u901F",
  "settings.mirrorTestHint": "\u5BF9\u771F\u5B9E\u7684\u5B98\u65B9\u5236\u54C1\u6D4B\u4E00\u6B21 TTFB \u4E0E\u541E\u5410\uFF08\u6BCF\u4E2A\u955C\u50CF\u6700\u591A\u7EA6 6 \u79D2\uFF09\u3002\u955C\u50CF\u7AD9\u70B9\u8BF4\u6CA1\u5C31\u6CA1\uFF0C\u88C5\u4E0D\u4E0A\u65F6\u5148\u6D4B\u4E00\u6B21\u3002",
  "settings.mirrorTestRun": "\u5F00\u59CB\u6D4B\u901F",
  "settings.mirrorTesting": "\u6D4B\u901F\u4E2D\u2026\uFF08\u6700\u591A\u7EA6 20 \u79D2\uFF09",
  "settings.mirrorTestOk": "\u6D4B\u901F\u5B8C\u6210",
  "settings.mirrorApplyFastest": "\u628A\u6700\u5FEB\u7684\u6392\u5230\u6700\u524D",
  "settings.mirrorApplied": "\u5DF2\u6309\u6D4B\u901F\u7ED3\u679C\u91CD\u6392\u955C\u50CF\u5217\u8868",
  "settings.telemetry": "\u5141\u8BB8 MathWorks \u533F\u540D\u9065\u6D4B",
  "settings.telemetryHint": "\u9ED8\u8BA4\u5173\u95ED\uFF08\u5411\u670D\u52A1\u5668\u4F20 --disable-telemetry=true\uFF09\u3002",
  "settings.shutdownMatlabOnUnload": "\u9000\u51FA\u65F6\u5173\u95ED MATLAB",
  "settings.shutdownMatlabOnUnloadHint": "\u63D2\u4EF6\u5378\u8F7D/\u7981\u7528\u65F6\uFF0C\u5173\u95ED\u7531\u672C\u63D2\u4EF6\u7684 MCP \u670D\u52A1\u5668\u542F\u52A8\u7684 MATLAB \u8FDB\u7A0B\uFF08\u6309\u7236\u5B50\u8FDB\u7A0B\u5F52\u5C5E\u5224\u65AD\uFF0C\u7EDD\u4E0D\u52A8\u4F60\u624B\u52A8\u6253\u5F00\u7684 MATLAB\uFF09\u3002",
  "settings.save": "\u4FDD\u5B58",
  "settings.saving": "\u4FDD\u5B58\u4E2D\u2026",
  "settings.saved": "\u5DF2\u4FDD\u5B58",
  "settings.saveFailed": "\u4FDD\u5B58\u5931\u8D25",
  "settings.resetAll": "\u6062\u590D\u9ED8\u8BA4",
  "settings.testConnection": "\u6D4B\u8BD5\u8FDE\u63A5",
  "settings.testingConnection": "\u6D4B\u8BD5\u4E2D\u2026",
  "settings.testOk": "MCP \u670D\u52A1\u5668\u5DF2\u63E1\u624B\u6210\u529F",
  "settings.testFailed": "MCP \u670D\u52A1\u5668\u4E0D\u53EF\u7528",
  "settings.deepTest": "\u6DF1\u5EA6\u81EA\u68C0\uFF08\u542F\u52A8 MATLAB\uFF09",
  "settings.deepTesting": "\u81EA\u68C0\u4E2D\uFF08\u4F1A\u542F\u52A8 MATLAB\uFF0C\u7EA6 20\u201360 \u79D2\uFF09\u2026",
  "settings.deepTestOk": "MATLAB \u5DF2\u8FDE\u901A",
  "settings.deepTestFailed": "MATLAB \u81EA\u68C0\u5931\u8D25",
  "settings.setup": "\u4E00\u952E\u5B89\u88C5 / \u4FEE\u590D",
  "settings.settingUp": "\u5B89\u88C5\u4E2D\u2026\uFF08\u9996\u6B21\u9700\u4E0B\u8F7D\u7EA6 19 MB \u4E8C\u8FDB\u5236\u4E0E\u6280\u80FD\u4ED3\uFF09",
  "settings.setupOk": "\u5B89\u88C5\u5B8C\u6210",
  "settings.setupFailed": "\u5B89\u88C5\u5931\u8D25",
  "settings.refreshStatus": "\u5237\u65B0\u72B6\u6001",
  "settings.reconnect": "\u91CD\u8FDE",
  "settings.reconnecting": "\u91CD\u8FDE\u4E2D\u2026",
  "settings.reconnectOk": "\u5DF2\u91CD\u65B0\u6302\u8F7D MCP \u5BA2\u6237\u7AEF",
  "settings.reconnectFailed": "\u91CD\u8FDE\u5931\u8D25",
  "settings.status": "\u72B6\u6001",
  "settings.statusLoading": "\u8BFB\u53D6\u4E2D\u2026",
  "settings.statusUnavailable": "\u65E0\u6CD5\u8BFB\u53D6\u72B6\u6001",
  "settings.statusReady": "\u5C31\u7EEA",
  "settings.statusNotReady": "\u672A\u5B89\u88C5\u5B8C\u6574",
  "settings.noMatlab": "\u672A\u68C0\u6D4B\u5230 MATLAB \u5B89\u88C5",
  "settings.candidates": "\u68C0\u6D4B\u5230\u7684 MATLAB",
  "settings.installHint": "\u9996\u6B21\u4F7F\u7528\u8BF7\u70B9\u300C\u4E00\u952E\u5B89\u88C5 / \u4FEE\u590D\u300D\uFF1A\u4E0B\u8F7D\u5B98\u65B9 MCP \u670D\u52A1\u5668\u4E8C\u8FDB\u5236\u3001MATLAB \u7AEF\u5DE5\u5177\u7BB1\u4E0E\u4E24\u4E2A Agentic Toolkit\uFF0C\u5E76\u6CE8\u518C Simulink \u5DE5\u5177\u5305\u8DEF\u5F84\u3002",
  "button.openMatlab": "\u6253\u5F00 MATLAB",
  "button.openMatlabHint": "\u6253\u5F00\u4E00\u4E2A MATLAB \u684C\u9762\u7A97\u53E3\u3002\u4F1A\u8BDD\u6A21\u5F0F\u4E3A auto/existing \u65F6\u4F1A\u4EE5\u5171\u4EAB\u4F1A\u8BDD\u65B9\u5F0F\u6253\u5F00\uFF0CAgent \u4E0E\u4F60\u5728\u540C\u4E00\u4E2A MATLAB \u91CC\u5DE5\u4F5C\uFF1Bnew \u6A21\u5F0F\u5219\u6253\u5F00\u72EC\u7ACB\u7A97\u53E3\u3002",
  "button.opening": "\u6B63\u5728\u6253\u5F00\u2026",
  "button.opened": "\u5DF2\u6253\u5F00 MATLAB"
};
var en = {
  "settings.title": "MATLAB / Simulink MCP",
  "settings.description": "Run MATLAB code and Simulink simulations from DSH through the official MathWorks MATLAB MCP Server, with Agentic Toolkit skills injected.",
  "settings.enabled": "Enable plugin",
  "settings.enabledHint": "When disabled the MCP client is disposed and mcp__matlab__* tools are unregistered.",
  "settings.announceToAgent": "Announce to Agent",
  "settings.announceToAgentHint": "Inject MATLAB usage rules (timeouts, figure export, Simulink tool preference, skill loading) into the system prompt.",
  "settings.matlabRoot": "MATLAB installation folder",
  "settings.matlabRootHint": "Empty = auto-detect (newest release first, e.g. D:\\MATLAB\\2025b).",
  "settings.sessionMode": "Session mode",
  "settings.sessionModeHint": "new: the plugin starts MATLAB (default, no manual step); auto: attach to a shared MATLAB when present, otherwise start one; existing: only attach to a shared session (run shareMATLABSession in MATLAB first).",
  "settings.sessionModeNew": "new (start our own, recommended)",
  "settings.sessionModeAuto": "auto (prefer an existing session)",
  "settings.sessionModeExisting": "existing (shared session only)",
  "settings.displayMode": "MATLAB display mode",
  "settings.displayModeHint": "desktop: show the MATLAB desktop (visible, easier to watch); nodesktop: no desktop (faster).",
  "settings.displayModeDesktop": "desktop (show desktop)",
  "settings.displayModeNodesktop": "nodesktop (no desktop)",
  "settings.initialWorkingFolder": "MATLAB working folder",
  "settings.initialWorkingFolderHint": "Empty = a workspace folder inside the plugin cache.",
  "settings.simulinkTools": "Enable Simulink tools",
  "settings.simulinkToolsHint": "Mount the 9 Simulink Agentic Toolkit model tools and register the toolkit path in MATLAB (addpath + savepath) during setup.",
  "settings.skillsEnabled": "Inject Agentic Toolkit skills",
  "settings.skillsEnabledHint": "Register the two Agentic Toolkits in this session's skill catalog (loaded on demand with the skill tool).",
  "settings.skillGroups": "Enabled skill groups",
  "settings.skillGroupsHint": 'Comma separated; empty = the default groups (matlab-core, matlab-programming, matlab-software-development, matlab-data-import-and-analysis, model-based-design-core, simulink-simulation); "none" disables them all.',
  "settings.toolCallTimeoutMs": "Tool call timeout (ms)",
  "settings.toolCallTimeoutMsHint": "Default 600000 (10 minutes); MATLAB cold start takes 20-45 s and simulations can take minutes.",
  "settings.allowMirrorDownload": "Allow mirror download",
  "settings.allowMirrorDownloadHint": "Off by default. Only when the direct GitHub download fails, use a mirror (default ghproxy.net) for the official MathWorks artifacts; while off, a direct failure reports which switch to enable.",
  "settings.downloadMirror": "Mirror list (tried in order)",
  "settings.downloadMirrorHint": "Comma separated, several allowed: tried in order. Templates accept {url} (prefix style, e.g. https://gh-proxy.com/{url}) and {path} (host replacement). With mirrors enabled they are tried first and direct GitHub is the fallback.",
  "settings.mirrorTest": "Mirror speed test",
  "settings.mirrorTestHint": "Measures TTFB and throughput against the real official artifact (up to ~6 s per mirror). Mirrors come and go, so run this when an install fails or crawls.",
  "settings.mirrorTestRun": "Run speed test",
  "settings.mirrorTesting": "Testing\u2026 (up to ~20 s)",
  "settings.mirrorTestOk": "Speed test finished",
  "settings.mirrorApplyFastest": "Put the fastest first",
  "settings.mirrorApplied": "Mirror list re-ordered by the measured speed",
  "settings.telemetry": "Allow MathWorks anonymous telemetry",
  "settings.telemetryHint": "Off by default (passes --disable-telemetry=true).",
  "settings.shutdownMatlabOnUnload": "Shut MATLAB down on unload",
  "settings.shutdownMatlabOnUnloadHint": "When the plugin unloads, stop the MATLAB started by its MCP server (ownership is decided by process parentage; a MATLAB you opened yourself is never touched).",
  "settings.save": "Save",
  "settings.saving": "Saving\u2026",
  "settings.saved": "Saved",
  "settings.saveFailed": "Save failed",
  "settings.resetAll": "Reset defaults",
  "settings.testConnection": "Test connection",
  "settings.testingConnection": "Testing\u2026",
  "settings.testOk": "MCP server handshake succeeded",
  "settings.testFailed": "MCP server unavailable",
  "settings.deepTest": "Deep self-test (starts MATLAB)",
  "settings.deepTesting": "Running (starts MATLAB, 20-60 s)\u2026",
  "settings.deepTestOk": "MATLAB is reachable",
  "settings.deepTestFailed": "MATLAB self-test failed",
  "settings.setup": "Install / repair",
  "settings.settingUp": "Installing\u2026 (first run downloads ~19 MB binary plus the toolkit repos)",
  "settings.setupOk": "Setup finished",
  "settings.setupFailed": "Setup failed",
  "settings.refreshStatus": "Refresh status",
  "settings.reconnect": "Reconnect",
  "settings.reconnecting": "Reconnecting\u2026",
  "settings.reconnectOk": "MCP client remounted",
  "settings.reconnectFailed": "Reconnect failed",
  "settings.status": "Status",
  "settings.statusLoading": "Loading\u2026",
  "settings.statusUnavailable": "Status unavailable",
  "settings.statusReady": "Ready",
  "settings.statusNotReady": "Not fully installed",
  "settings.noMatlab": "No MATLAB installation detected",
  "settings.candidates": "Detected MATLAB",
  "settings.installHint": 'On first use press "Install / repair": it downloads the official MCP server binary, the MATLAB toolbox and both Agentic Toolkits, then registers the Simulink toolkit path.',
  "button.openMatlab": "Open MATLAB",
  "button.openMatlabHint": "Open a MATLAB desktop window. In auto/existing session mode it opens a shared session so the agent works in the same MATLAB; in new mode it opens an independent window.",
  "button.opening": "Opening\u2026",
  "button.opened": "MATLAB opened"
};

// src/client/index.ts
var NS2 = "matlab-mcp";
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS2, { zh, en }), "matlab-mcp: dictionaries");
  const settingsScope = createMatlabMcpSettingsScope();
  const controller = new MatlabMcpSettingsCardController(settingsScope);
  ctx.slots.inject("settings.section", () => {
    const unregister = ctx.slots.register({
      name: "settings.section",
      id: "matlab-mcp",
      order: 41,
      label: () => ctx.locale.bind(NS2)("settings.title"),
      locale: NS2,
      inject: () => controller.inject()
    }, MatlabMcpSettingsCard);
    return () => {
      controller.dispose();
      unregister();
    };
  });
  const openController = new MatlabOpenController();
  ctx.slots.inject("conversation.session.header.actions", () => {
    const unregister = ctx.slots.register({
      name: "conversation.session.header.actions",
      id: "matlab-mcp-open",
      order: 40,
      label: () => ctx.locale.bind(NS2)("button.openMatlab"),
      locale: NS2,
      inject: () => openController.inject()
    }, MatlabOpenButton);
    return () => {
      unregister();
    };
  });
}

    return module.exports;
  }
});