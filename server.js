module.exports = {
  createServer:function createServer( config , readyCallback ){
    var util = require('util');
    var dhcpjs = require('dhcpjs');
    var server = dhcpjs.createServer();
    server.on('message', function(m) {
        console.log(util.inspect(m, false, 3));
    });
    server.on('listening', function(address) {
        console.log('listening on ' + address);
        readyCallback(address);
    });
    server.bind(null,config.serverPort);
    return server;
  }
}
