const { parse: parseSetCookie } = require('set-cookie-parser');
const { parse, serialize } = require('cookie');

class Cookie {
  constructor(init = null) {
    this.cookies = {};
    if (init) this.store(init);
  }
  store(str) {
    Object.assign(this.cookies, parse(str));
  }
  storeFromResponse(res) {
    parseSetCookie(res).forEach(({ name, value }) => (this.cookies[name] = value));
  }
  stringify() {
    return Object.entries(this.cookies)
      .map(([name, value]) => serialize(name, value))
      .join('; ');
  }
}

module.exports = Cookie;
