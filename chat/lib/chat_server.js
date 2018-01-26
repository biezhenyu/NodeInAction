// 引入Socket.IO
var socketio = require('socket.io');

// 定义并初始化了一些定义聊天状态的变量
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};
// 确立链接逻辑
exports.listen = function(server) {
  // 启动Socket.IO服务器，允许它搭载在已有的HTTP服务器上
  io = socketio.listen(server);
  io.set('log level', 1);
  // 定义每个用户连接的处理逻辑
  io.sockets.on('connection', function (socket) {

    // 在用户连接上来时赋予其一个访客名
    guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);

    // 在用户链接上来把他放入Lobby聊天室里
    joinRoom(socket, 'Lobby');

    // 处理用户的消息，更名，以及聊天室的创建和变更
    handleMessageBroadcasting(socket, nickNames);
    handleNameChangeAttempts(socket, nickNames, namesUsed);
    handleRoomJoining(socket);

    //用户发出请求时，向其提供已经被占用的聊天室的列表
    socket.on('rooms', function() {
      socket.emit('rooms', io.sockets.manager.rooms);
    });

    // 定义用户断开连接后的清楚逻辑
    handleClientDisconnection(socket, nickNames, namesUsed);
  });
};

// 分配用户昵称
function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
  // 生成新昵称
  var name = 'Guest' + guestNumber;
  // 把用户昵称跟客户端版链接ID关联上
  nickNames[socket.id] = name;
  // 让用户知道的他们的昵称
  socket.emit('nameResult', {
    success: true,
    name: name
  });
  namesUsed.push(name); // 存放已经使用的名字
  return guestNumber + 1;
}

// 进去聊天室相关的逻辑
function joinRoom(socket, room) {
  socket.join(room);  // 让用户进入房间

  // 记录用户当前的房间
  currentRoom[socket.id] = room;

  // 让用户知道他们进入了新的房间
  socket.emit('joinResult', {room: room});

  // 让房间里的其他用户知道有新用户进入了房间
  socket.broadcast.to(room).emit('message', {
    text: nickNames[socket.id] + ' has joined ' + room + '.'
  });

  // 确定有哪些用户在这个房间里
  var usersInRoom = io.sockets.clients(room);

  // 如果不止一个用户在这个房间里，汇总下都是谁
  if (usersInRoom.length > 1) {
    var usersInRoomSummary = 'Users currently in ' + room + ': ';
    for (var index in usersInRoom) {
      var userSocketId = usersInRoom[index].id;
      if (userSocketId != socket.id) {
        if (index > 0) {
          usersInRoomSummary += ', ';
        }
        usersInRoomSummary += nickNames[userSocketId];
      }
    }
    usersInRoomSummary += '.';

    // 将房间里其他用户的汇总发给这个用户
    socket.emit('message', {text: usersInRoomSummary});
  }
}

// 更名请求的处理逻辑
function handleNameChangeAttempts(socket, nickNames, namesUsed) {
  socket.on('nameAttempt', function(name) {
    // 昵称不能以Guest开头
    if (name.indexOf('Guest') == 0) {
      socket.emit('nameResult', {
        success: false,
        message: 'Names cannot begin with "Guest".'
      });
    } else {
      // 如果还没注册就注册上
      if (namesUsed.indexOf(name) == -1) {
        var previousName = nickNames[socket.id];
        var previousNameIndex = namesUsed.indexOf(previousName);
        namesUsed.push(name);
        nickNames[socket.id] = name;
        delete namesUsed[previousNameIndex]; // 删掉之前用的昵称
        socket.emit('nameResult', {
          success: true,
          name: name
        });
        socket.broadcast.to(currentRoom[socket.id]).emit('message', {
          text: previousName + ' is now known as ' + name + '.'
        });
      } else {
        socket.emit('nameResult', {
          success: false,
          message: 'That name is already in use.'
        });
      }
    }
  });
}
// 发送聊天信息
function handleMessageBroadcasting(socket) {
  socket.on('message', function (message) {
    socket.broadcast.to(message.room).emit('message', {
      text: nickNames[socket.id] + ': ' + message.text
    });
  });
}

// 添加让用户加入已有房间的逻辑，如果房间还没有的话，则创建一个房间
function handleRoomJoining(socket) {
  socket.on('join', function(room) {
    socket.leave(currentRoom[socket.id]);
    joinRoom(socket, room.newRoom);
  });
}
// 用户端开链接（当用户离开聊天程序时，从nickNames 和 namesUsed 中移除用户的昵称）
function handleClientDisconnection(socket) {
  socket.on('disconnect', function() {
    var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
    delete namesUsed[nameIndex];
    delete nickNames[socket.id];
  });
}
