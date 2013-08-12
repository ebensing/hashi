
var https = require('https');
var asanaModels = require('../models/asana.js');
var Workspace = asanaModels.Workspace;
var Project = asanaModels.Project;
var Task = asanaModels.Task;
var Story = asanaModels.Story;

function AsanaConnector() {
  this.apiKey = null;
  this.apiUrl = "app.asana.com";
  this.basePath = "/api/1.0/";
}

AsanaConnector.prototype.setKey = function (apiKey) {
  this.apiKey = apiKey;
}

AsanaConnector.prototype.getWorkspaces = function (callback) {
  var options = {
    hostname : this.apiUrl,
    path : this.basePath + "workspaces",
    method : "GET",
    auth : this.apiKey +":"
  };

  var req = https.request(options, function (res) {
    var content = "";

    res.on('data', function (data) {
      content += data.toString();
    });

    res.on('end', function () {
      var respObj = JSON.parse(content);

      var workspaces = [];
      for (var i=0; i < respObj.data.length; i++) {
        workspaces.push(new Workspace(respObj.data[i]));
      }

      return callback(null, workspaces);
    });
  });
  req.on('error', function (err) {
    return callback(err);
  });
  req.end();
}

AsanaConnector.prototype.getProjects = function (workspace, callback) {
  var options = {
    hostname : this.apiUrl,
    path : this.basePath + "workspaces/" + workspace.id.toString() + "/projects",
    method : "GET",
    auth : this.apiKey +":"
  };

  var req = https.request(options, function (res) {
    var content = "";

    res.on('data', function (data) {
      content += data.toString();
    });

    res.on('end', function () {
      var respObj = JSON.parse(content);

      var projects = [];
      for (var i=0; i < respObj.data.length; i++) {
        var p = new Project(respObj.data[i]);
        p.workspace = workspace;
        projects.push(p);
      }

      return callback(null, projects);
    });
  });
  req.on('error', function (err) {
    return callback(err);
  });
  req.end();
}

AsanaConnector.prototype.getTasksByProject = function (project, callback) {
  var options = {
    hostname : this.apiUrl,
    path : this.basePath + "projects/" + project.id.toString() + "/tasks",
    method : "GET",
    auth : this.apiKey +":"
  };

  var req = https.request(options, function (res) {
    var content = "";

    res.on('data', function (data) {
      content += data.toString();
    });

    res.on('end', function () {
      var respObj = JSON.parse(content);

      var tasks = [];
      for (var i=0; i < respObj.data.length; i++) {
        var t = new Task(respObj.data[i]);
        t.projects.push(project);
        t.workspace = project.workspace;
        tasks.push(t);
      }

      return callback(null, tasks);
    });
  });
  req.on('error', function (err) {
    return callback(err);
  });
  req.end();
}

AsanaConnector.prototype.getStories = function (task, callback) {
  var options = {
    hostname : this.apiUrl,
    path : this.basePath + "tasks/" + task.id.toString() + "/stories",
    method : "GET",
    auth : this.apiKey +":"
  };

  var req = https.request(options, function (res) {
    var content = "";

    res.on('data', function (data) {
      content += data.toString();
    });

    res.on('end', function () {
      var respObj = JSON.parse(content);

      var stories = [];
      for (var i=0; i < respObj.data.length; i++) {
        var s = new Story(respObj.data[i]);
        s.target = task;
        stories.push(s);
      }

      return callback(null, stories);
    });
  });
  req.on('error', function (err) {
    return callback(err);
  });
  req.end();
}

module.exports = exports = new AsanaConnector();
