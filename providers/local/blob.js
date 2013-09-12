var fs = require('fs')
  , log = require('../../log')
  , path = require('path');

function LocalBlobProvider(config) {
    if (!config.blob_storage_path) {
        log.warn("Local storage path not configured.");
        return;
    }
    
    fs.mkdir(config.blob_storage_path);
    this.config = config;
}

LocalBlobProvider.prototype.create = function(blob, readStream, callback) {
    var fileStream = fs.createWriteStream(this.makePath(blob));

    readStream.pipe(fileStream);

    // TODO: handle errors in pipe
    // TODO: how to get end event on finish of pipe
    callback();
};

LocalBlobProvider.prototype.makePath = function(blob) {
    return path.join(this.config.blob_storage_path, blob.id);
};

LocalBlobProvider.prototype.stream = function(blob, stream, callback) {
    var blobPath = this.makePath(blob);
    var self = this;

    fs.exists(blobPath, function(exists) {
        if (!exists) return callback(null, null);

        var fileStream = fs.createReadStream(self.makePath(blob));
        fileStream.pipe(stream);
        // TODO: handle errors in pipe
        fileStream.on('end', function() {
            callback(null, blob);
        }); 
    });
};

LocalBlobProvider.prototype.remove = function(blob, callback) {
    log.info("removing blob with id: " + blob.id);
    fs.unlink(this.makePath(blob), callback);
};

module.exports = LocalBlobProvider;
