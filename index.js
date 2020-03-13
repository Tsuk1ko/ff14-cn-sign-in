const { get, post } = require('axios');
const { stringify: qs } = require('qs');
const Cookie = require('./src/cookie');

const areaIdEnum = {
  陆行鸟: 1,
  莫古力: 6,
  猫小胖: 7,
};
Object.freeze(areaIdEnum);

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
};

class Client {
  constructor(config = { user: '', passwd: '', area: '', server: '', role: '' }, options = { log: false }) {
    this.options = options;
    this.log('Config', JSON.stringify(config));
    if (Object.values(config).some(v => !v)) throw new Error('参数缺失');
    if (!(config.area in areaIdEnum)) throw new Error('大区有误');
    this.config = config;
    this.cookies = new Cookie();
    this.areaId = areaIdEnum[config.area];
  }

  log() {
    if (this.options.log) console.log(new Date().toLocaleString(), '|', ...Array.from(arguments));
  }

  getHeader() {
    return {
      ...headers,
      Cookie: this.cookies.stringify(),
    };
  }

  // 获取 ticket
  async step1() {
    const res = await get('https://cas.sdo.com/authen/staticLogin.jsonp', {
      headers,
      params: {
        callback: 'staticLogin_JSONPMethod',
        inputUserId: this.config.user,
        password: this.config.passwd,
        appId: '100001900',
        areaId: '1',
        serviceUrl: 'http://act.ff.sdo.com/20180707jifen/Server/SDOLogin.ashx?returnPage=index.html',
        productVersion: 'v5',
        frameType: '3',
        locale: 'zh_CN',
        version: '21',
        tag: '20',
        authenSource: '2',
        productId: '2',
        scene: 'login',
        usage: 'aliCode',
        customSecurityLevel: '2',
        autoLoginFlag: '0',
        _: Date.now(),
      },
    });
    this.cookies.storeFromResponse(res);
    const data = JSON.parse(res.data.replace(/staticLogin_JSONPMethod\((.+)\)/, '$1'));
    if (!data.data.ticket) throw new Error(data.data.failReason || data.return_message || '登录失败，可能是由于异地登录/登陆次数过多，服务器已要求验证码，请先通过正常网页方式签到，过 1~3 天再试');
    return data.data.ticket;
  }

  // 设置 cookie
  async step2() {
    const res = await get('http://login.sdo.com/sdo/Login/Tool.php', {
      headers: this.getHeader(),
      params: {
        value: `index|${this.config.user}`,
        act: 'setCookie',
        name: 'CURRENT_TAB',
        r: '0.8326684884385089',
      },
    });
    this.cookies.storeFromResponse(res);
  }

  // 设置 cookie
  async step3() {
    const res = await get('https://cas.sdo.com/authen/getPromotionInfo.jsonp', {
      headers: this.getHeader(),
      params: {
        callback: 'getPromotionInfo_JSONPMethod',
        appId: '991000350',
        areaId: '1001',
        serviceUrl: 'http://act.ff.sdo.com/20180707jifen/Server/SDOLogin.ashx?returnPage=index.html',
        productVersion: 'v5',
        frameType: '3',
        locale: 'zh_CN',
        version: '21',
        tag: '20',
        authenSource: '2',
        productId: '2',
        scene: 'login',
        usage: 'aliCode',
        customSecurityLevel: '2',
        _: Date.now(),
      },
    });
    this.cookies.storeFromResponse(res);
  }

  // 设置 cookie
  async step4(ticket) {
    const res = await get('http://act.ff.sdo.com/20180707jifen/Server/SDOLogin.ashx', {
      headers: this.getHeader(),
      params: {
        returnPage: 'index.html',
        ticket,
      },
    });
    this.cookies.storeFromResponse(res);
  }

  // 获取角色列表
  async step5() {
    const res = await get('http://act.ff.sdo.com/20180707jifen/Server/ff14/HGetRoleList.ashx', {
      headers: this.getHeader(),
      params: {
        method: 'queryff14rolelist',
        ipid: this.areaId,
        i: '0.8075943537407986',
      },
    });
    const data = res.data;
    const { server, role } = this.config;
    const found = data.Attach.find(({ worldnameZh, name }) => worldnameZh === server && name === role);
    if (!found) throw new Error('没有找到对应的角色');
    return [found.cicuid, found.worldname, found.groupid].join('|');
  }

  // 选择区服及角色
  async step6(roleStr) {
    const { area, server, role } = this.config;
    const res = await post(
      'http://act.ff.sdo.com/20180707jifen/Server/ff14/HGetRoleList.ashx',
      qs({
        method: 'setff14role',
        AreaId: this.areaId,
        AreaName: area,
        RoleName: `[${server}]${role}`,
        Role: roleStr,
        i: '0.8326684884385089',
      }),
      { headers: this.getHeader() }
    );
    this.cookies.storeFromResponse(res);
  }

  // 签到
  async step7() {
    const res = await post(
      'http://act.ff.sdo.com/20180707jifen/Server/User.ashx',
      qs({
        method: 'signin',
        i: '0.855755357775076',
      }),
      { headers: this.getHeader() }
    );
    this.log(res.data.Message);
  }

  // 查询积分
  async step8() {
    const res = await post(
      'http://act.ff.sdo.com/20180707jifen/Server/User.ashx',
      qs({
        method: 'querymystatus',
        i: '0.855755357775076',
      }),
      { headers: this.getHeader() }
    );
    this.log('当前积分', JSON.parse(res.data.Attach).Jifen);
  }

  async signIn() {
    this.log('登录中');
    const ticket = await this.step1();
    this.log('设置 Cookie', '1/3');
    await this.step2();
    this.log('设置 Cookie', '2/3');
    await this.step3();
    this.log('设置 Cookie', '3/3');
    await this.step4(ticket);
    this.log('正在获取角色列表');
    const roleStr = await this.step5();
    this.log('正在选择区服及角色');
    await this.step6(roleStr);
    this.log('签到中');
    await this.step7();
    await this.step8();
  }
}

module.exports = Client;
