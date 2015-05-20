var requireLike = require('require-like');
var path = require('path');
var through = require('through');
var gutil = require('gulp-util');
var mochaRequire = requireLike(require.resolve('mocha'), true);
var fs = require('fs');
var hooker = require('./hooker');
var blanket = require('blanket');
var Duplex = require('stream').Duplex;

module.exports = function (options) {
    var Mocha = mochaRequire('mocha');
    var duplex = new Duplex({objectMode: true});

    blanket(options.blanket);
    duplex._write = function (file, encoding, done) {
        var cover = new Mocha(options);
        delete require.cache[require.resolve(path.resolve(file.path))];
        cover.addFile(file.path);
        try {
            if (options.captureFile) {
                fd = fs.openSync(process.cwd() + '/' + options.captureFile, 'w');
            }
            hooker.hook(process.stdout, 'write', {
                // This gets executed before the original process.stdout.write
                pre: function(result) {
                    // Write result to file if it was opened
                    if (fd) {
                        fs.writeSync(fd, result);
                    }
                    return hooker.preempt();
                }
            });
            cover.run(function (errCount) {
                if (fd) {
                    fs.closeSync(fd);
                }
                // Restore process.stdout.write to its original value
                hooker.unhook(process.stdout, 'write');
                duplex.push(file);
                done();
            }.bind(this));
        } catch (err) {
            this.emit('error', err);
            done();
        }
    };

    duplex.on('finish', function () {
        return;
    });

    duplex._read = function () {};

    return duplex;
};
