"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.config = void 0;
exports.default = handler;
const config = exports.config = {
  runtime: 'edge'
};
async function handler(req) {
  return new Response('Hello from Edge Function!', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
}
//# sourceMappingURL=hello.js.map