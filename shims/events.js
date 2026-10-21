// Small EventEmitter for libraries that import Node's `events`.
function EventEmitter() {
  this._events = {};
}
EventEmitter.prototype.on = function on(name, fn) {
  (this._events[name] = this._events[name] || []).push(fn);
  return this;
};
EventEmitter.prototype.addListener = EventEmitter.prototype.on;
EventEmitter.prototype.once = function once(name, fn) {
  const wrapper = (...args) => {
    this.off(name, wrapper);
    fn.apply(this, args);
  };
  return this.on(name, wrapper);
};
EventEmitter.prototype.off = function off(name, fn) {
  this._events[name] = (this._events[name] || []).filter((f) => f !== fn);
  return this;
};
EventEmitter.prototype.removeListener = EventEmitter.prototype.off;
EventEmitter.prototype.emit = function emit(name, ...args) {
  (this._events[name] || []).slice().forEach((fn) => fn.apply(this, args));
  return (this._events[name] || []).length > 0;
};
EventEmitter.EventEmitter = EventEmitter;
module.exports = EventEmitter;
