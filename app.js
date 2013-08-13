
var async = require('async');
var mongoose = require('mongoose');

var config = require('./config.js');
var AsanaConnector = require('./connectors/asana.js');
var GithubConnector = require('./connectors/github.js');
var AsanaModels = require('./models/asana.js');
var Workspace = AsanaModels.Workspace;
var Project = AsanaModels.Project;
var Task = AsanaModels.Task;

AsanaConnector.setKey(config.asanaKey);

GithubConnector.setAuthInfo(config.githubInfo.userName,
    config.githubInfo.password);

function main() {

  getAllWorkspaces(function (err, workspaces) {
    if (err) {
      return onError(err);
    }

    getMonitoredProjects(workspaces, function (err, projects) {
      if (err) {
        return onError(err);
      }

      getMonitoredTasks(projects, function (err) {
        console.log("Asana tasks done!");
        mongoose.disconnect();
      });
    });
  });
}

function getAllWorkspaces(callback) {

  AsanaConnector.getWorkspaces(function (err, workspaces) {
    if (err) {
      return callback(err);
    }

    async.each(workspaces, function (w, cb) {
      var raw = w.toObject();
      // gross, maybe think of a better way to do this?
      delete raw._id;
      Workspace.findOneAndUpdate({ id : w.id }, raw, { upsert : true }, cb);
    }, function (err) {
      callback(err, workspaces);
    });
  });
}

function getMonitoredProjects(workspaces, callback) {

  var watchedWorkspaces = config.bindings.map(function (item) {
    return item.workspace;
  });

  async.map(workspaces, function (w, cb) {
    if (watchedWorkspaces.indexOf(w.name) == -1) {
      return cb();
    }
    AsanaConnector.getProjects(w, cb);
  }, function (err, mapped) {
    if (err) {
      return callback(err);
    }

    // flatten into a 1-dim array
    var projects = [];
    projects = projects.concat.apply(projects, mapped);
    // strip out the undefined values
    projects = projects.filter(function (item) {
      return item;
    });

    async.each(projects, function (proj, cb) {
      // again, gross-- find a better way to do this
      var raw = proj.toObject();
      delete raw._id;
      Project.findOneAndUpdate({ id : proj.id }, raw, { upsert : true }, cb);
    }, function (err) {
      callback(err, projects);
    });
  });
}

function getMonitoredTasks(projects, callback) {

  var monitoredProjects = config.bindings.map(function (item) {
    return item.project;
  });

  async.map(projects, function (project, cb) {
    if (monitoredProjects.indexOf(project.name) == -1) {
      return cb();
    }
    AsanaConnector.getTasksByProject(project, cb);
  }, function (err, mapped) {
    if (err) {
      return callback(err);
    }

    // flatten & filter
    var tasks = [];
    tasks = tasks.concat.apply(tasks, mapped);
    tasks = tasks.filter(function (item) {
      return item;
    });

    async.each(tasks, function (task, cb) {
      // still not good the 3rd time...
      var raw = task.toObject();
      delete raw._id;
      Task.findOneAndUpdate({ id : task.id }, raw, { upsert : true }, cb);
    }, callback);
  });
}

function onError(err) {
  console.log(err);
}
mongoose.connect("mongodb://localhost/taskSync", function (err) {
  if (err) throw err;
  main();
});
