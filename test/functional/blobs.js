var app = require('../../server')
  , assert = require('assert')
  , core = require('nitrogen-core')
  ,	fs = require('fs')
  , request = require('request');

describe('blobs REST endpoint', function() {
    if (core.config.blob_provider) {

        it('should be able to create and then fetch a blob', function (done) {

            fs.createReadStream(core.config.blob_fixture_path).pipe(
                request.post({ url: core.config.blobs_endpoint,
                               headers: { 'Content-Type': 'image/jpeg',
                                          'Authorization': core.fixtures.models.accessTokens.device.toAuthHeader() } },
                    function (err, resp, body) {
                        assert.ifError(err);

                        var bodyJson = JSON.parse(body);
                        assert.equal(resp.statusCode, 200);
                        assert.equal(bodyJson.blob._id, undefined);
                        assert.notEqual(bodyJson.blob.id, undefined);
                        assert.notEqual(bodyJson.blob.link, undefined);

                        var blobUrl = core.config.blobs_endpoint + '/' + bodyJson.blob.id;

                        // owner should be able to access blob

                        request.get(blobUrl,
                          { headers: { 'Authorization': core.fixtures.models.accessTokens.device.toAuthHeader() } }, function(err,resp,body) {
                            assert.ifError(err);
                            assert.equal(resp.statusCode, 200);
                            assert.equal(resp.body.length, 28014);

                            // other users shouldn't be able to access blob
                            request.get(blobUrl, { headers: { 'Authorization': core.fixtures.models.accessTokens.anotherUser.toAuthHeader() } }, function(err,resp,body) {
                                assert.ifError(err);

                                assert.equal(resp.statusCode, 403);
                                request.get(blobUrl, { headers: { 'Authorization': core.fixtures.models.accessTokens.user.toAuthHeader() } }, function(err,resp,body) {
                                    assert.ifError(err);
                                    assert.equal(resp.statusCode, 200);

                                    done();
                                });
                            });
                        });
                    }
                )
            );
        });

        it('should return 404 for unknown blobs', function(done) {
            request(core.config.blobs_endpoint + '/51195d5f11600000deadbeef', {
                headers: {
                    'Authorization': core.fixtures.models.accessTokens.device.toAuthHeader()
                }
            }, function(err, resp, body) {
                assert(!err);

                assert.equal(resp.statusCode, 404);

                done();
            });
        });

        it('should not allow unauthenticated access to blobs', function(done) {
            request(core.config.blobs_endpoint + '/51195d5f11600000deadbeef', function(err,resp,body) {
                assert.equal(resp.statusCode, 401);

                done();
            });
        });

        it('should not allow unauthorized access to blobs', function(done) {
            request(core.config.blobs_endpoint + '/51195d5f11600000deadbeef', function(err,resp,body) {
                assert.equal(resp.statusCode, 401);

                done();
            });
        });
    }
});