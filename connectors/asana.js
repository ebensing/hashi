
var https = require('https');
var qs = require('querystring');
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

/**
 * Set the API Key
 *
 * @param {String} apiKey - The Asana API key
 *
 */

AsanaConnector.prototype.setKey = function (apiKey) {
  this.apiKey = apiKey;
}

/**
 * Gets all of the workspaces for the user associated with the API key. This
 * returns unsaved mongoose models of the workspaces.
 *
 * @param {Function} callback - function(err, workspaces)
 *
 */

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

/**
 * Gets all of the projects associated with a specified workspace. Returns
 * unsaved mongoose models of the projects
 *
 * @param {Workspace} workspace
 * @param {Function} callback - function(err, projects)
 *
 */

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

/**
 * Get all of the tasks associated with a given project. Returns unsaved
 * mongoose models of the tasks
 *
 * @param {Project} project
 * @param {Function} callback - function(err, tasks)
 *
 */

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

/**
 * Get all of the stories associated with a given task. Returns unsaved
 * mongoose models of the stories
 *
 * @param {Task} task
 * @param {Function} callback - function(err, stories)
 *
 */

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

/**
 * Creates a task in Asana
 *
 * **Note** The returned task is not saved to the DB.
 *
 * @param {Task} task - This is a mongoose model of a Task
 * @param {Function} callback - function(err, task)
 *
 */

AsanaConnector.prototype.createTask = function (task, callback) {

  // prepare the data to send
  var raw = task.toObject();
  raw.assignee = "me";
  raw.workspace = task.workspace.id;
  raw.projects[0] = task.projects[0].id;
  var sendStr = qs.stringify(raw);

  // prepare the POST options
  var options = {
    hostname : this.apiUrl,
    path : this.basePath + "tasks",
    method : "POST",
    auth : this.apiKey +":",
    headers : {
      'Content-Type' : 'application/x-www-form-urlencoded',
      'Content-Length' : sendStr.length
    }
  };

  var req = https.request(options, function (res) {
    res.setEncoding('utf-8');
    var content = "";

    res.on('data', function (data) {
      content += data.toString();
    });

    res.on('end', function () {
      var respObj = JSON.parse(content).data;

      if (respObj.message) {
        return callback(new Error("Task Create Error, Title: " + task.name));
      }

      task.id = respObj.id;
      task.assignee = respObj.assignee;
      task.workspace = respObj.workspace;
      task.projects[0] = respObj.projects[0];
      task.created_at = respObj.created_at;
      task.modified_at = respObj.modified_at;

      var rt = new Task(task);

      return callback(null, rt);
    });
  });
  req.on('error', function (err) {
    return callback(err);
  });

  // actually send the data
  req.write(sendStr);
  req.end();
}

/**
 *
 * Update an existing task in Asana
 *
 * **Note** The returned task is saved to the DB
 *
 * @param {Task} task
 * @param {Object} changeSet - set of attributes to change on the task
 * @param {Function} callback - function(err, task)
 *
 */

AsanaConnector.prototype.updateTask = function (task, changeSet, callback) {

  // prepare the data to send
  var sendStr = qs.stringify(changeSet);

  // prepare the POST options
  var options = {
    hostname : this.apiUrl,
    path : this.basePath + "tasks/" + task.id.toString(),
    method : "PUT",
    auth : this.apiKey +":",
    headers : {
      'Content-Type' : 'application/x-www-form-urlencoded',
      'Content-Length' : sendStr.length
    }
  };

  var req = https.request(options, function (res) {
    res.setEncoding('utf-8');
    var content = "";

    res.on('data', function (data) {
      content += data.toString();
    });

    res.on('end', function () {
      var respObj = JSON.parse(content);

      if (respObj.message) {
        return callback(new Error("Task Update Error, Id: " + task.toString()
            + " " + respObj.message));
      }

      task.save(callback);
    });
  });
  req.on('error', function (err) {
    return callback(err);
  });

  req.write(sendStr);
  req.end();
}

module.exports = exports = new AsanaConnector();
