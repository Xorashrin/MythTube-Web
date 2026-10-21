// Node's `stream` is not available in React Native. cheerio's parse5 only references it for an
// unused streaming serializer, so empty constructors are enough to let the bundle load.
function Stream() {}
function Readable() {}
function Writable() {}
function Transform() {}
function PassThrough() {}
module.exports = { Stream, Readable, Writable, Transform, PassThrough };
