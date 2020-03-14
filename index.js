require('colors');
const { get, post } = require('axios');
const { stringify: qs } = require('qs');
const Cookie = require('./src/cookie');
const FF14CSIError = require('./src/error');

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
    this.config = {};
    for (const key of ['user', 'passwd', 'area', 'server', 'role']) {
      this.config[key] = config[key];
    }
    this.options = options;
    this.cookies = new Cookie();
  }

  async signIn() {
    const stdoutWithTime = (...argv) => {
      if (this.options.log) process.stdout.write([new Date().toLocaleString().gray, '|'.gray, ...argv, ''].join(' '));
    };

    const logWithTime = (...argv) => {
      if (this.options.log) console.log(new Date().toLocaleString().gray, '|'.gray, ...argv);
    };

    const log = (...argv) => {
      if (this.options.log) console.log(...argv);
    };

    logWithTime('参数', JSON.stringify(this.config));
    if (Object.values(this.config).some(v => !v)) throw new FF14CSIError('参数缺失');
    if (!(this.config.area in areaIdEnum)) throw new FF14CSIError('大区有误');
    const areaId = areaIdEnum[this.config.area];

    const getHeader = () => ({
      ...headers,
      Cookie: this.cookies.stringify(),
    });

    // 获取 ticket
    const step1 = async () => {
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
      if (!data.data.ticket) throw new Error(data.data.failReason || data.return_message || '登录失败，可能是由于异地登录/登陆次数过多，服务器已要求验证码，请先通过网页方式正常签到，1~3 天后再试');
      return data.data.ticket;
    };

    // 设置 cookie
    const step2 = async () => {
      const res = await get('http://login.sdo.com/sdo/Login/Tool.php', {
        headers: getHeader(),
        params: {
          value: `index|${this.config.user}`,
          act: 'setCookie',
          name: 'CURRENT_TAB',
          r: '0.8326684884385089',
        },
      });
      this.cookies.storeFromResponse(res);
    };

    // 设置 cookie
    const step3 = async () => {
      const res = await get('https://cas.sdo.com/authen/getPromotionInfo.jsonp', {
        headers: getHeader(),
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
    };

    // 设置 cookie
    const step4 = async ticket => {
      const res = await get('http://act.ff.sdo.com/20180707jifen/Server/SDOLogin.ashx', {
        headers: getHeader(),
        params: {
          returnPage: 'index.html',
          ticket,
        },
      });
      this.cookies.storeFromResponse(res);
    };

    // 获取角色列表
    const step5 = async () => {
      const res = await get('http://act.ff.sdo.com/20180707jifen/Server/ff14/HGetRoleList.ashx', {
        headers: getHeader(),
        params: {
          method: 'queryff14rolelist',
          ipid: areaId,
          i: '0.8075943537407986',
        },
      });
      const data = res.data;
      const { server, role } = this.config;
      const found = data.Attach.find(({ worldnameZh, name }) => worldnameZh === server && name === role);
      if (!found) throw new Error('没有找到对应的角色');
      return [found.cicuid, found.worldname, found.groupid].join('|');
    };

    // 选择区服及角色
    const step6 = async roleStr => {
      const { area, server, role } = this.config;
      const res = await post(
        'http://act.ff.sdo.com/20180707jifen/Server/ff14/HGetRoleList.ashx',
        qs({
          method: 'setff14role',
          AreaId: areaId,
          AreaName: area,
          RoleName: `[${server}]${role}`,
          Role: roleStr,
          i: '0.8326684884385089',
        }),
        { headers: getHeader() }
      );
      this.cookies.storeFromResponse(res);
    };

    // 签到
    const step7 = async () => {
      const res = await post(
        'http://act.ff.sdo.com/20180707jifen/Server/User.ashx',
        qs({
          method: 'signin',
          i: '0.855755357775076',
        }),
        { headers: getHeader() }
      );
      log(res.data.Message);
    };

    // 查询积分
    const step8 = async () => {
      const res = await post(
        'http://act.ff.sdo.com/20180707jifen/Server/User.ashx',
        qs({
          method: 'querymystatus',
          i: '0.855755357775076',
        }),
        { headers: getHeader() }
      );
      log('当前积分', JSON.parse(res.data.Attach).Jifen);
    };

    stdoutWithTime('登录');
    const ticket = await step1();
    log('√');
    stdoutWithTime('设置 Cookie', '1/3');
    await step2();
    log('√');
    stdoutWithTime('设置 Cookie', '2/3');
    await step3();
    log('√');
    stdoutWithTime('设置 Cookie', '3/3');
    await step4(ticket);
    log('√');
    stdoutWithTime('获取角色列表');
    const roleStr = await step5();
    log('√');
    stdoutWithTime('选择区服及角色');
    await step6(roleStr);
    log('√');
    stdoutWithTime('签到中');
    await step7();
    log('√');
    await step8();
  }
}

module.exports = Client;
