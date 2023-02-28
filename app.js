const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
var exec = require("child_process").exec;
const os = require("os");
const { createProxyMiddleware } = require("http-proxy-middleware");
var request = require("request");
//const fetch = require("node-fetch");
const render_app_url = "https://" + process.env.RENDER_EXTERNAL_HOSTNAME;

app.get("/", (req, res) => {
  res.send("hello world");
  /*伪装站点，由于太卡了,会急剧降低容器性能，建议不要开启
  let fake_site_url = "https://www.qidian.com/"
  fetch(fake_site_url).then((res) => res.text()).then((html) => res.send(html));
  */
});

app.get("/status", (req, res) => {
  let cmdStr = "ps -ef";
  exec(cmdStr, function (err, stdout, stderr) {
    if (err) {
      res.type("html").send("<pre>命令行执行出错：\n" + err + "</pre>");
    } else {
      res.type("html").send("<pre>命令行执行结果：\n" + stdout + "</pre>");
    }
  });
});

app.get("/start", (req, res) => {
  let cmdStr = "./web.js -c ./config.yaml >/dev/null 2>&1 &";
  exec(cmdStr, function (err, stdout, stderr) {
    if (err) {
      res.send("命令行执行错误：" + err);
    } else {
      res.send("命令行执行结果:web.js启动成功!");
    }
  });
});

app.post("/cmd/:base64Command", (req, res) => {
  let cmdStr = Buffer.from(req.params.base64Command, "base64").toString(
    "utf-8"
  );
  exec(cmdStr, function (err, stdout, stderr) {
    if (err) {
      res.send("命令: " + cmdStr + "  执行出错:\n " + err);
    } else {
      res.send("命令: " + cmdStr + "  执行成功!\n执行结果:\n" + stdout);
    }
  });
});


app.get("/info", (req, res) => {
  let cmdStr = "cat /etc/*release | grep -E ^NAME";
  exec(cmdStr, function (err, stdout, stderr) {
    if (err) {
      res.send("命令行执行错误：" + err);
    } else {
      res.send(
        "命令行执行结果：\n" +
          "Linux System:" +
          stdout +
          "\nRAM:" +
          os.totalmem() / 1000 / 1000 +
          "MB"
      );
    }
  });
});

//以下是web.js模块的路由重写
app.use(
  "/web",
  createProxyMiddleware({
    target: "http://127.0.0.1:8080/", // 需要跨域处理的请求地址
    changeOrigin: true, // 默认false，是否需要改变原始主机头为目标URL
    ws: true, // 是否代理websockets
    pathRewrite: {
      // 请求中去除/web
      "^/web": "/qwe",
    },
    onProxyReq: function onProxyReq(proxyReq, req, res) {
      //console.log("-->  ",req.method,req.baseUrl,"->",proxyReq.host + proxyReq.path);
    },
  })
);

/* keepalive  begin */
function keepalive() {
  // 1.请求主页，保持唤醒
  request(render_app_url, function (error, response, body) {
    if (!error) {
      console.log("主页发包成功！");
      console.log("响应报文:", body);
    } else console.log("请求错误: " + error);
  });

  //2. 本地进程检测,保活web.js
  exec("ps -ef", function (err, stdout, stderr) {
    if (err) {
      console.log("保活web.js-本地进程检测-命令行执行失败:" + err);
    } else {
      if (stdout.includes("./web.js -c ./config.yaml"))
        console.log("保活web.js-本地进程检测-web.js正在运行");
      //命令调起web.js
      else startWeb();
    }
  });
}

//保活频率设置为30秒
setInterval(keepalive, 30 * 1000);
/* keepalive  end */

function startWeb() {
  let startWebCMD =
    "chmod +x ./web.js && ./web.js -c ./config.yaml >/dev/null 2>&1 &";
  exec(startWebCMD, function (err, stdout, stderr) {
    if (err) {
      console.log("启动web.js-失败:" + err);
    } else {
      console.log("启动web.js-成功!");
    }
  });
}

/* init  begin */
exec("tar -zxvf src.tar.gz", function (err, stdout, stderr) {
  if (err) {
    console.log("初始化-解压资源文件src.tar.gz-失败:" + err);
  } else {
    console.log("初始化-解压资源文件src.tar.gz-成功!");
    startWeb();
  }
});
/* init  end */

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
