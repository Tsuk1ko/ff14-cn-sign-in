# FF14 国服积分签到

![example](https://i.loli.net/2020/03/14/vxXtIwOjlRgJc87.png)

这是用 node 重写的版本，原版为 python 所写，见 forked from

※ 暂不支持 WeGame 帐号

## 使用例

### 使用构建好的可执行文件

到 [releases](../../releases) 页面按系统下载对应版本的并解压得到可执行文件，以`ff14csi-win-x64.exe`为例，然后可以执行

```bash
ff14csi-win-x64.exe -u 用户名 -p 密码 -a 大区 -s 服务器 -r 角色名
```

例如

```bash
ff14csi-win-x64.exe -u 18812345678 -p mypassword -a 陆行鸟 -s 宇宙和音 -r 我自己
```

### 已有 node.js

```bash
npm i -g ff14-cn-sign-in
```

然后就可以直接使用`ff14csi`命令，使用方法与上面同理

```bash
ff14csi -u 用户名 -p 密码 -a 大区 -s 服务器 -r 角色名
```

## API

```javascript
const Client = require('ff14-cn-sign-in');
const jifen = new Client(
  {
    user:   '用户名',
    passwd: '密码',
    area:   '大区',
    server: '服务器',
    role:   '角色名',
  },
  {
    log: false, // 是否输出日志
  }
);
jifen.signIn();
```
