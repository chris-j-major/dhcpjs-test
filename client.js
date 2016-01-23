module.exports = {
  createClient:function createClient( config ){
    var util = require('util');
    var dhcpjs = require('dhcpjs');

    var client = new dhcpjs.Client();
    client.bind('0.0.0.0', config.clientPort, function() {
        console.log('bound to 0.0.0.0:'+config.clientPort);
    });
    return client;
  }
}
