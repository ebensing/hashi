
var async = require('async');
var mongoose = require('mongoose');
var http = require('http');

var config = require('./config.js');
var AsanaConnector = require('./connectors/asana.js');
var GithubConnector = require('./connectors/github.js');
var AsanaModels = require('./models/asana.js');
var GithubModels = require('./models/github.js')
var Workspace = AsanaModels.Workspace;
var Project = AsanaModels.Project;
var Task = AsanaModels.Task;
var Issue = GithubModels.Issue;
var Hook = GithubModels.Hook;

// setup the authentication stuff
AsanaConnector.setKey(config.asanaKey);

GithubConnector.setAuthInfo(config.githubInfo.userName,
    config.githubInfo.password);

// 10 minutes between runs of the main sync function
var INTERVAL = 60 * 10 * 1000;

/**
 * This is the main startup method. It will also run periodically to make sure
 * everything is in sync.
 *
 * Might be necessary to synchronize these runs with anything going on in the
 * Webhook. But going to wait and see on that one.
 */

function main() {

  var workMap = {};
  var projectMap = {};

  var dataGathered = false;
  function cont(err) {
    if (err) {
      return onError(err);
    }
    dataGathered && parse(repos, workMap, projectMap);
    dataGathered = true;
  }

  // get Asana stuff
  getAllWorkspaces(function (err, workspaces) {
    if (err) {
      return onError(err);
    }
    // make the workspace map
    for (var i=0; i < workspaces.length; i++) {
      var w = workspaces[i];
      workMap[w.name] = w.id;
    }
    getMonitoredProjects(workspaces, function (err, projects) {
      if (err) {
        return onError(err);
      }
      // make the project map
      for (var i=0; i < projects.length; i++) {
        var p = projects[i];
        projectMap[p.name] = p.id;
      }
      getMonitoredTasks(projects, cont);
    });
  });

  // get Github stuff
  var repos = config.bindings.map(function (item) {
    var arr = item.repo.split('/');
    var repo = {
      user : arr[0],
      name : arr[1],
      assignee : item.githubUser,
      project : item.project,
      workspace : item.workspace
    };
    return repo;
  });

  getAllIssues(repos, cont);
}

/**
 * Once we get here, all of the data has been collected and is saved in the
 * database. Time to process it and update anything that needs it
 *
 * @param {Array} repos - This is an array of the repos that need to be watched
 *                        and processed. They have additional fields on them
 *                        necessary for the processing, see main().
 * @param {Object} workMap - This is an object of workspace names that maps to
 *                           workspace Ids
 * @param {Object} projectMap - This is an object of project names that maps to
 *                              project Ids
 *
 */
function parse(repos, workMap, projectMap) {
  console.log("All Data collected!");

  async.each(repos, function (repo, callback) {
    var cond = {
      repo : {
        user : repo.user,
        name : repo.name
      },
      'assignee.login' : repo.assignee
    };
    Issue.find(cond, function (err, issues) {
      if (err) {
        return callback(err)
      }
      // set the project & workspace on all the issues
      issues = issues.map(function (item) {
        item.p_id = projectMap[repo.project];
        item.w_id = workMap[repo.workspace];
        return item;
      });
      async.each(issues, processIssue, callback);
    });

    // make sure the appropriate webhooks exist
    checkHooks(repo);
  }, function (err) {
    setTimeout(function () {
      main();
    }, INTERVAL);
    if (err) {
      return onError(err);
    }
    console.log("done");
  });
}

/**
 * This function checks to make sure the issue hook exists on the repo, and if
 * it does not, creates it.
 *
 * @param {Object} repo - This is the repo object that describes the repo we
 *                        want to check
 *
 */

function checkHooks(repo) {
  var cond = { repo : { name : repo.name, user : repo.user } };
  Hook.findOne(cond, function (err, hook) {
    if (err) {
      return onError(err);
    }

    if (hook == null) {
      var url = config.url + ":" + config.port.toString();
      GithubConnector.createWebHook(repo, ["issues"], url, function (err, hook) {
        if (err) {
          if (err.errors && err.errors.length &&
            err.errors[0].message != "Hook already exists on this repository") {
            return onError(err);
          } else {
            console.log("Hook already exsits, do nothing");
            return;
          }
        }
        console.log("Hook Created for %s/%s", repo.user, repo.name);
      });
    }
  });
}

/**
 * This decides whether a Task exists in Asana for this issue. If it does, then
 * sync it, else create a new task.
 *
 * @param {Issue} issue - This is the issue to check for
 * @param {Function} callback
 *
 */

function processIssue(issue, callback) {

  var tag = '"(gh ' + issue.number.toString() + ')"';

  Task.textSearch(tag, function (err, output) {
    if (err) {
      return callback(err);
    }

    if (output.results.length) {
      // found the match, go ahead and just sync'd them up
      syncIssue(issue, output.results[0].obj, callback);
    } else {
      // no match found, time to create a new task in Asana
      createAsanaTask(issue, tag, callback);
    }
  });
}

/**
 * Syncs an existing Issue and an existing task
 *
 * @param {Issue} issue
 * @param {Task} task
 * @param {Function} callback - function(err)
 *
 */

function syncIssue(issue, task, callback) {
  var changeSet = {};

  if (issue.title != task.name) {
    task.name = issue.title;
    changeSet.name = issue.title;
  }

  if (issue.state == 'closed' && !task.completed) {
    task.completed = true;
    task.completed_at = issue.closed_at;
    changeSet.completed = true;
  }

  var body = "(GH " + issue.number.toString() +")\n"
    + issue.body + "\n" + issue.html_url;

  if (task.notes != body) {
    task.notes = body;
    changeSet.notes = body;
  }

  // only perform the update if there have actually been changes
  if (Object.keys(changeSet).length !== 0) {
    AsanaConnector.updateTask(task, changeSet, callback);
  } else {
    callback();
  }
}

/**
 * Create a new Asana Task for the specified Github Issue
 *
 * @param {Issue} issue
 * @param {String} tag - This is the tag that goes in the Task notes field to
 *                       associate it with the Github Issue
 * @param {Function} callback - function(err, task)
 *
 */

function createAsanaTask(issue, tag, callback) {

  var task = new Task({
    completed : false,
    name : issue.title,
    notes : tag.replace(/\"/g,'') + "\n" + issue.body + "\n" + issue.html_url,
    assignee_status : "inbox",
    projects : [{ id : issue.p_id }],
    workspace : { id : issue.w_id }
  });

  AsanaConnector.createTask(task, function (err, cTask) {
    if (err) {
      return callback(err);
    }
    var raw = cTask.toObject();
    Task.findOneAndUpdate({ id : cTask.id }, raw, { upsert : true }, callback);
  });
}

/**
 *
 * Fetches all of the issues for a given repository that belong to a given user
 * (specified on the repo object). After this call has returned, the MongoDB
 * data will be up to date.
 *
 * @param {Array} repos - repos to get issues for. Each item in the array must
 *                        contain data on the repo owner name and repo name, as
 *                        well as, information on the user whose issues you
 *                        want to get
 * @param {Function} callback - function(err, issues)
 *
 */

function getAllIssues(repos, callback) {
  async.each(repos, function (repo, cb) {
    GithubConnector.getAllRepoIssues(repo, repo.assignee, "open", function (err, issues) {
      if (err) {
        return callback(err);
      }
      GithubConnector.getAllRepoIssues(repo, repo.assignee, "closed", function (err, closed) {
        if (err) {
          return callback(err);
        }
        var all = issues.concat(closed);
        saveItems(all, Issue, cb);
      });
    });
  }, callback);
}

/**
 * Takes an array of items and a reference to a mongoose model, and then
 * upserts them into MongoDB based off of the `id` field.
 *
 * @param {Array} items - array of plain objects to upsert
 * @param {Model} iClass - the model that the objects conform to
 * @param {Function} callback - function(err, savedModels)
 *
 */

function saveItems(items, iClass, callback) {
  async.map(items, function (item, cb) {
    var raw = item.toObject();
    iClass.findOneAndUpdate({ id : item.id }, raw, { upsert : true }, cb);
  }, callback);
}

/**
 * Gets all workspaces for the user associated with the Asana API Key provided.
 *
 * @param {Function} callback - function(err, workspaces)
 *
 */

function getAllWorkspaces(callback) {
  AsanaConnector.getWorkspaces(function (err, workspaces) {
    if (err) {
      return callback(err);
    }
    saveItems(workspaces, Workspace, callback);
  });
}

/**
 * Based off the config file, grabs the Asana Projects that we are interested
 * in adding things to
 *
 * @param {Array} workspaces - this is an array of workspace models
 * @param {Function} callback - function(err, projects)
 *
 */

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

    saveItems(projects, Project, callback);
  });
}

/**
 * Gets the tasks we care about based off of the projects list.
 *
 * @param {Array} projects - array of projects for which to get the tasks for
 * @param {Function} callback - function(err, tasks)
 *
 */

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

    saveItems(tasks, Task, callback);
  });
}

/**
 * This is what gets called anytime there is an error. Should probably be doing
 * more graceful failure here.
 *
 * @param {Error} err
 *
 */

function onError(err) {
  console.log(err);
}

/**
 * Connect to the database
 */

mongoose.connect("mongodb://localhost/hashi", function (err) {
  if (err) throw err;
  // run the main loop and sync up the data
  main();

  // create the server that will be watching for the webhooks
  http.createServer(function (req, res) {
    var data = "";
    req.on('data', function (d) {
      data += d.toString();
    });

    req.on('end', function () {
      var reqObj;
      try {
        reqObj = JSON.parse(data);
      } catch(err) {
        return onError(err);
      }

      var issue = new Issue(reqObj.issue);
      var raw = issue.toObject();
      Issue.findOneAndUpdate({ id : issue.id }, raw, { upsert : true }, function (err, is) {
        if (err) {
          return onError(err);
        }
        processIssue(is, function (err) {
          if (err) {
            return onError(err);
          }
        });
      });
    });

    res.writeHead(200, "OK", { 'Content-type' : 'text/html' });
    res.end();
  }).listen(config.port, function () {
    console.log("Listening on port %d", config.port);
  });
});
