var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), member.set(obj, value), value);
var _ref;
class SceneObjectRef {
  constructor(ref) {
    __privateAdd(this, _ref);
    __privateSet(this, _ref, ref);
  }
  resolve() {
    return __privateGet(this, _ref);
  }
}
_ref = new WeakMap();

export { SceneObjectRef };
//# sourceMappingURL=SceneObjectRef.js.map
