var app = require('../../server')
  , assert = require('assert')
  , core = require('nitrogen-core')
  , io = require('socket.io-client')
  , request = require('request');

describe('messages endpoint', function() {

    it('index should be not be accessible anonymously', function(done) {
        request(core.config.messages_endpoint, function(err, resp, body) {
            assert.equal(resp.statusCode, 401);
            done();
        });
    });

    it('index should return all messages', function(done) {
        request({ url: core.config.messages_endpoint,
                  headers: { Authorization: core.fixtures.models.accessTokens.user.toAuthHeader() },
                  json: true }, function(err,resp,body) {
            assert.equal(resp.statusCode, 200);
            assert.equal(resp.headers['X-n2-set-access-token'], undefined);

            assert.notEqual(body.messages, undefined);
            assert.equal(body.messages.length > 0, true);

            done();
        });
    });

    it('index query should return only those messages', function(done) {
        request({ url: core.config.messages_endpoint + "?type=ip",
                  headers: { Authorization: core.fixtures.models.accessTokens.device.toAuthHeader() },
                  json: true }, function(err,resp,body) {

            assert.equal(resp.statusCode, 200);

            assert.notEqual(body.messages, undefined);
            assert.equal(body.messages.length > 0, true);

            body.messages.forEach(function(message) {
                assert.equal(message.type === 'ip', true);
            });

            done();
        });
    });

    it('index should not be accessible with an invalid accessToken', function(done) {
        request({ url: core.config.messages_endpoint,
            headers: { Authorization: "Bearer DEADBEEF" } }, function(err,resp,body) {
            assert.equal(resp.statusCode, 401);
            done();
        });
    });

    it('show should be not be accessible without accessToken', function(done) {
        request(core.config.messages_endpoint + '/' + core.fixtures.models.messages.deviceIp.id, function(err, resp, body) {
            assert.equal(resp.statusCode, 401);
            done();
        });
    });

    it('create should be not be accessible without accessToken', function(done) {
        request.post(core.config.messages_endpoint,
            { json: [{ from: core.fixtures.models.principals.device.id,
                       type: "_custom"}] }, function(err, resp, body) {
            assert.equal(err, null);
            assert.equal(resp.statusCode, 401);
            done();
        });
    });

    it('delete should be only accessible to service principal', function(done) {
        var query = encodeURIComponent(JSON.stringify({ "_id" : core.fixtures.models.messages.deviceIp.id }));
        request.del({ url: core.config.messages_endpoint + "?q=" + query,
                      json: true,
                      headers: { Authorization: core.fixtures.models.accessTokens.device.toAuthHeader() } }, function(del_err, del_resp, del_body) {

                assert.equal(del_err, null);
                assert.equal(del_resp.statusCode, 403);

                done();
            }
        );

    });

    it('should be able to create a message via socket.io', function(done) {
        var socket = io.connect(core.config.subscriptions_endpoint, {
            query: "auth=" + encodeURIComponent(core.fixtures.models.accessTokens.device.token),
            'force new connection': true
        });

        var subscriptionId = 'sub1';
        socket.emit('start', {
            id: subscriptionId,
            filter: {
                type: '_messageSubscriptionTest'
            },
            type: 'message'
        });

        var messageBundle = {
            uniqueId: 'ABC123',
            messages: [
                {
                    type: '_custom',
                    body: {
                        seq: 1
                    }
                },
                {
                    type: '_custom',
                    body: {
                        seq: 2
                    }
                }
            ]
        };

        // give the subscription time to setup 'messages' channel.
        setTimeout(function() {
            socket.emit('messages', messageBundle);
        }, 200);

        socket.on(messageBundle.uniqueId, function(response) {
            console.log(response.error)
            assert(!response.error);

            assert.equal(response.messages.length, 2);
            assert(response.messages[0].id);
            assert.equal(response.messages[0].body.seq, 1);

            done();
        });
    });

    it('should create and fetch a message', function(done) {
        var subscriptionPassed = false
          , restPassed = false
          , isDone = false;

        var socket = io.connect(core.config.subscriptions_endpoint, {
            query: "auth=" + encodeURIComponent(core.fixtures.models.accessTokens.device.token),
            'force new connection': true
        });

        var subscriptionId = 'sub1';
        socket.emit('start', { id: subscriptionId, filter: { type: '_messageSubscriptionTest' }, type: 'message' });

        socket.on(subscriptionId, function(message) {
            assert.equal(message.type, '_messageSubscriptionTest');
            assert.equal(message.body.reading, 5.1);

            subscriptionPassed = true;
            socket.emit('stop', { id: subscriptionId });

            if (subscriptionPassed && restPassed && !isDone) {
                isDone = true;
                done();
            }
        });

        setTimeout(function() {
            request.post(core.config.messages_endpoint, {
                json: [{
                    from: core.fixtures.models.principals.device.id,
                    type: "_messageSubscriptionTest",
                    index_until: 'forever',
                    expires: 'never',
                    body: { reading: 5.1 }
                }],
                headers: {
                    Authorization: core.fixtures.models.accessTokens.device.toAuthHeader()
                }
            }, function(post_err, post_resp, post_body) {
                assert.equal(post_err, null);
                assert.equal(post_resp.statusCode, 200);

                var message_id = null;
                post_body.messages.forEach(function(message) {
                    assert.equal(message.body.reading, 5.1);
                    message_id = message.id;
                });

                assert.notEqual(message_id, null);

                request({
                    url: core.config.messages_endpoint + '/' + message_id,
                    json: true,
                    headers: {
                        Authorization: core.fixtures.models.accessTokens.device.toAuthHeader()
                    }
                }, function(get_err, get_resp, get_body) {
                    assert(!get_err);
                    assert.equal(get_resp.statusCode, 200);

                    assert.equal(get_body.message.body.reading, 5.1);
                    assert.equal(Date.parse(get_body.message.expires), core.models.Message.NEVER_EXPIRE.getTime());
                    assert.equal(Date.parse(get_body.message.index_until), core.models.Message.INDEX_FOREVER.getTime());
                    assert.notEqual(get_body.message.created_at, 5.1);

                    var query = encodeURIComponent(JSON.stringify({ "_id" : message_id }));
                    request.del({
                        url: core.config.messages_endpoint + "?q=" + query,
                        json: true,
                        headers: {
                            Authorization: core.fixtures.models.accessTokens.service.toAuthHeader()
                        }
                    }, function(del_err, del_resp, del_body) {
                        assert(!del_err);
                        assert.equal(del_resp.statusCode, 200);

                        restPassed = true;
                        if (subscriptionPassed && restPassed && !isDone) {
                            isDone = true;
                            done();
                        }
                    });
                });
            });
        }, core.config.pubsub_provider.MAX_LATENCY || 200);
    });
});
