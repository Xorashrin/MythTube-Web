// Minimal `util` for libraries that only need inherits/inspect/format.
function inherits(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, { constructor: { value: ctor, enumerable: false, writable: true, configurable: true } });
}
function format(...args) {
  return args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
}
module.exports = { inherits, format, inspect: (v) => JSON.stringify(v), deprecate: (fn) => fn, isArray: Array.isArray };
