/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var fs = require('fs-extra');
var path = require("path");
var util = require("../../util");

function getStoragePath(storageBaseDir, scope) {
    if(scope.indexOf(":") === -1){
        if(scope === "global"){
            return path.join(storageBaseDir,"global",scope);
        }else{ // scope:flow
            return path.join(storageBaseDir,scope,"flow");
        }
    }else{ // scope:local
        var ids = scope.split(":")
        return path.join(storageBaseDir,ids[1],ids[0]);
    }
}

function getBasePath(config) {
    var base = config.base || "contexts";
    var storageBaseDir;
    if (!config.dir) {
        if(config.settings && config.settings.userDir){
            storageBaseDir = path.join(config.settings.userDir, base);
        }else{
            try {
                fs.statSync(path.join(process.env.NODE_RED_HOME,".config.json"));
                storageBaseDir = path.join(process.env.NODE_RED_HOME, base);
            } catch(err) {
                try {
                    // Consider compatibility for older versions
                    if (process.env.HOMEPATH) {
                        fs.statSync(path.join(process.env.HOMEPATH,".node-red",".config.json"));
                        storageBaseDir = path.join(process.env.HOMEPATH, ".node-red", base);
                    }
                } catch(err) {
                }
                if (!storageBaseDir) {
                    storageBaseDir = path.join(process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH || process.env.NODE_RED_HOME,".node-red", base);
                }
            }
        }
    }else{
        storageBaseDir = path.join(config.dir, base);
    }
    return storageBaseDir;
}

function loadFile(storagePath){
    return fs.pathExists(storagePath).then(function(exists){
        if(exists === true){
            return fs.readFile(storagePath, "utf8");
        }else{
            return Promise.resolve(undefined);
        }
    }).catch(function(err){
        throw Promise.reject(err);
    });
}

function LocalFileSystem(config){
    this.config = config;
    this.storageBaseDir = getBasePath(this.config);
}

LocalFileSystem.prototype.open = function(){
    return Promise.resolve();
}

LocalFileSystem.prototype.close = function(){
    return Promise.resolve();
}

LocalFileSystem.prototype.get = function(scope, key, callback) {
    if(typeof callback !== "function"){
        throw new Error("Callback must be a function");
    }
    var storagePath = getStoragePath(this.storageBaseDir ,scope);
    loadFile(storagePath + ".json").then(function(data){
        if(data){
            callback(null, util.getMessageProperty(JSON.parse(data),key));
        }else{
            callback(null, undefined);
        }
    }).catch(function(err){
        callback(err);
    });
};

LocalFileSystem.prototype.set =function(scope, key, value, callback) {
    var storagePath = getStoragePath(this.storageBaseDir ,scope);
    loadFile(storagePath + ".json").then(function(data){
        var obj = data ? JSON.parse(data) : {}
        util.setMessageProperty(obj,key,value);
        return fs.outputFile(storagePath + ".json", JSON.stringify(obj, undefined, 4), "utf8");
    }).then(function(){
        if(typeof callback === "function"){
            callback(null);
        }
    }).catch(function(err){
        if(typeof callback === "function"){
            callback(err);
        }
    });
};

LocalFileSystem.prototype.keys = function(scope, callback){
    if(typeof callback !== "function"){
        throw new Error("Callback must be a function");
    }
    var storagePath = getStoragePath(this.storageBaseDir ,scope);
    loadFile(storagePath + ".json").then(function(data){
        if(data){
            callback(null, Object.keys(JSON.parse(data)));
        }else{
            callback(null, []);
        }
    }).catch(function(err){
        callback(err);
    });
};

LocalFileSystem.prototype.delete = function(scope){
    var storagePath = getStoragePath(this.storageBaseDir ,scope);
    return fs.remove(storagePath + ".json");
}

LocalFileSystem.prototype.clean = function(activeNodes){
    var self = this;
    return fs.readdir(self.storageBaseDir).then(function(dirs){
        return Promise.all(dirs.reduce(function(result, item){
            if(item !== "global" && activeNodes.indexOf(item) === -1){
                result.push(fs.remove(path.join(self.storageBaseDir,item)));
            }
            return result;
        },[]));
    }).catch(function(err){
        if(err.code == 'ENOENT') {
            return Promise.resolve();
        }else{
            return Promise.reject(err);
        }
    });
}

module.exports = function(config){
    return new LocalFileSystem(config);
};
