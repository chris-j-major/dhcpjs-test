module.exports = {
  createClient:function createClient(){
    var util = require('util');
    var dhcpjs = require('dhcpjs');

    var client = new dhcpjs.Client();
    client.bind('0.0.0.0', 1068, function() {
        console.log('bound to 0.0.0.0:1068');
    });
    return client;
  }
}
