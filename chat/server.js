// 这个程序不会用Ajax发送和接收聊天消息，但它仍要用HTTP发送用在用户浏览器中的 HTML、CSS和客户端JavaScript。

// 内置的http模块提供了HTPP服务器和客户端功能
var http = require('http');
var fs  = require('fs');

// 内置的path模块提供了与文件系统相关的功能
var path = require('path');

// mime模块有根据文件扩展名得出MIME类型的能力
var mime = require('mime');

// cache是用来缓存文件内容对象
var cache = {};

// 文件不存在发送404错误
function send404(response) {
  response.writeHead(404, {'Content-Type': 'text/plain'});
  response.write('Error 404: resource not found.');
  response.end();
}


// 提供文件数据服务
function sendFile(response, filePath, fileContents) {
  response.writeHead(
    200, 
    {"content-type": mime.lookup(path.basename(filePath))}
  );
  response.end(fileContents);
}
// 访问内存（RAM）要比访问文件系统快得多，所以Node程序通常会把常用的数据缓存到内 存里。我们的聊天程序就要把静态文件缓存到内存中，只有第一次访问的时候才会从文件系统中 读取。

// 提供静态文件服务
function serveStatic(response, cache, absPath) {

    // 检查文件是否存在内存中
  if (cache[absPath]) {

      // 从内存返回文件
    sendFile(response, absPath, cache[absPath]);
  } else {

      // 检查文件是否存在
    fs.exists(absPath, function(exists) {
      if (exists) {

        // 读取文件
        fs.readFile(absPath, function(err, data) {
          if (err) {
            send404(response);
          } else {
            cache[absPath] = data;
            sendFile(response, absPath, data);
          }
        });
      } else {
        send404(response);
      }
    });
  }
}

// 创建HTTP服务器
var server = http.createServer(function(request, response) {
  var filePath = false;
  if (request.url == '/') {
    // 返回默认的HTML文件
    filePath = 'public/index.html';
  } else {
    // 将url转化为文件的相对路径
    filePath = 'public' + request.url;
  }

  var absPath = './' + filePath;
  serveStatic(response, cache, absPath);
});

server.listen(3000, function() {
  console.log("Server listening on port 3000.");
});
// 加载定制的Node模块，它提供的逻辑是用来处理基于Socket.IO的服务端聊天功能的
var chatServer = require('./lib/chat_server');

// 启动Socket.IO服务器，给它提供一个已经定义好的HTTP服务器，这样它就能跟HTTP服务器共享同一个TCP/IP端口
chatServer.listen(server);
