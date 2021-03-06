let express = require("express");
let router = express.Router();
let fs = require("fs");
let url = require("url");
let iconv = require("iconv-lite");
let dealFn = require("./dealfn.js");

let database = null;
let programmes = null;
let lottery = null;
let maxVoteTimes = 5;

dealFn.readFileData("database.json").then(
  data => {
    database = data;
    database.data.total = database.data.objects.length;
  },
  msg => {
    console.log(msg);
  }
);

dealFn.readFileData("programme.json").then(
  data => {
    programmes = data;
    programmes.data.total = programmes.data.objects.length;
  },
  msg => {
    console.log(msg);
  }
);

dealFn.readFileData("lotteryData.json").then(
  data => {
    lottery = data;
    lottery.data.total = lottery.data.objects.length;
  },
  msg => {
    console.log(msg);
  }
);

exports.index = (req, res) => {
  res.render("index");
};

exports.detail = (req, res) => {
  res.render("detail");
};

exports.register = (req, res) => {
  res.render("register");
};

exports.search = (req, res) => {
  res.render("search");
};

exports.rule = (req, res) => {
  res.render("rule");
};

// 获取节目列表数据接口
exports.index_data = (req, res) => {
  let query = url.parse(req.url, true).query,
    offset = +query.offset,
    limit = +query.limit,
    sendObjs = programmes.data.objects.slice(offset, offset + limit),
    sendData = {
      errno: 0,
      msg: "success",
      data: {
        total: database.data.total,
        offset: offset,
        limit: limit,
        objects: sendObjs
      }
    };
  if (offset > programmes.data.total) {
    sendData.data.objects = [];
  }
  res.send(JSON.stringify(sendData));
};

// 投票接口
exports.index_poll = (req, res) => {
  let query = url.parse(req.url, true).query,
    id = +query.id,
    ownObj = {},
    voterId = +query.voterId,
    sendData = {
      errno: 0,
      msg: "投票成功"
    },
    pollUser = dealFn.getItem(id, programmes.data.objects),
    voter = dealFn.getItem(voterId, database.data.objects);
  for (let i = 0; i < pollUser.vfriend.length; i++) {
    if (pollUser.vfriend[i].id === voterId) {
      sendData.errno = "-1";
      sendData.msg = "已经给TA投过票了";
      res.send(JSON.stringify(sendData));
      return;
    }
  }
  if (voter.vote_times >= maxVoteTimes) {
    sendData.errno = "-2";
    sendData.msg = "每个人最多能投5票，您已经使用完了";
    res.send(JSON.stringify(sendData));
    return;
  } else {
    if (maxVoteTimes - voter.vote_times - 1) {
      sendData.msg +=
        "，还有" +
        (maxVoteTimes - voter.vote_times - 1) +
        "次机会，投满5票才能生效哦～";
    }
  }
  ownObj = dealFn.cloneUser(voter);
  pollUser.vfriend.push(ownObj);
  pollUser.vote++;
  programmes.data.objects = dealFn.sortRank(programmes.data.objects);
  dealFn.writeFileData("database.json", database).then(
    msg => {
      console.log(msg);
    },
    msg => {
      console.log(msg);
    }
  );
  dealFn.writeFileData("programme.json", programmes).then(
    msg => {
      console.log(msg);
    },
    msg => {
      console.log(msg);
    }
  );
  res.send(JSON.stringify(sendData));
};

// 注册接口
exports.register_data = (req, res) => {
  let total = database.data.total,
    registerData = req.body,
    sendData = {};

  let user = dealFn.getItemByMobile(registerData.mobile, database.data.objects);
  if (user) {
    sendData = {
      errno: -1,
      msg: "该手机号已被注册"
    };
    res.send(JSON.stringify(sendData));
    return;
  }

  database.data.total++;
  registerData.gender === "boy"
    ? (registerData.head_icon = "/images/boy.png")
    : (registerData.head_icon = "/images/girl.png");
  registerData.id = ++total;
  registerData.vote = 0;
  registerData.rank = 0;
  registerData.vote_times = 0;
  registerData.vfriend = [];
  database.data.objects.push(registerData);
  dealFn.writeFileData("database.json", database).then(
    msg => {
      console.log(msg);
    },
    msg => {
      console.log(msg);
    }
  );
  sendData = {
    errno: 0,
    msg:
      "报名成功，您的用户编号为" +
      registerData.id +
      "（用于登入验证）,请妥善保管！",
    id: registerData.id
  };
  res.send(JSON.stringify(sendData));
};

exports.index_info = (req, res) => {
  let total = database.data.total,
    registerData = req.body,
    sendData = {
      errno: 0,
      msg: "验证通过",
      id: registerData.id
    },
    isUser = dealFn.matchUser(
      +registerData.id,
      database.data.objects,
      registerData.password
    );

  if (!isUser) {
    sendData.errno = -1;
    sendData.msg = "您输入的用户名或者密码不正确";
  }
  sendData.user = dealFn.getItem(+registerData.id, database.data.objects);
  res.send(JSON.stringify(sendData));
};

// 搜索数据接口
exports.index_search = (req, res) => {
  let searchData = req.query,
    content = searchData.content,
    sendData = {
      errno: 0,
      msg: "success",
      data: {}
    };

  sendData.data = dealFn.serchItems(content, programmes.data.objects);
  res.send(JSON.stringify(sendData));
};

// 详情数据接口
exports.detail_data = (req, res) => {
  let detailData = req.query,
    id = +detailData.id,
    userDetailObj = dealFn.getItem(id, programmes.data.objects),
    sendData = {
      errno: 0,
      msg: "success",
      data: {}
    };

  userDetailObj.vfriend = userDetailObj.vfriend.sort(function(a, b) {
    return b.time - a.time;
  });
  sendData.data = userDetailObj;
  res.send(JSON.stringify(sendData));
};

exports.lottery_get = (req, res) => {
  let sendObjs = lottery.data.objects,
    sendData = {
      errno: 0,
      msg: "success",
      data: {
        objects: sendObjs
      }
    };

  res.send(JSON.stringify(sendData));
};

exports.lottery_save = (req, res) => {
  let lotteryData = req.query,
    sendData = {
      errno: 0,
      msg: "insert success",
      data: {}
    };

  if (lotteryData.log) {
    lottery.data.objects.push({
      time: new Date().toTimeString(),
      data: lotteryData.log
    });
    dealFn.writeFileData("lotteryData.json", lottery).then(
      msg => {
        console.log(msg);
      },
      msg => {
        console.log(msg);
      }
    );
  } else {
    sendData.msg = "insert error";
  }
  res.send(JSON.stringify(sendData));
};
