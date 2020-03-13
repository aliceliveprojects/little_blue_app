(function () {
    'use strict';

    angular
        .module('eventsjs')
        .factory('eventsSrvc', eventsSrvc);

    eventsSrvc.$inject = [
        '$q', // promises service
        '$timeout' // timeout service

    ];

    function eventsSrvc(
        $q,
        $timeout
    ) {
        var eventsArray = [];
        var event = {};
        var detail = {};
        var device_id = "";
        var service_id = "";
        var characteristic_id = "";
        var property = "";
        var isBusy = false;
        var isSubscribed = false;
        var service = {};

        var TIMEOUT_MS = 5000;
        var REQUESTED_MTU_SIZE_BYTES = 200; // RPi is usually 20 bytes Maximum Transmission Unit 

        function concatTypedArrays(a, b) { // a, b TypedArray of same type
            var c = new (a.constructor)(a.length + b.length);
            c.set(a, 0);
            c.set(b, a.length);
            return c;
        }

        function concatBuffers(a, b) {
            return concatTypedArrays(
                new Uint8Array(a.buffer || a),
                new Uint8Array(b.buffer || b)
            ).buffer;
        }


       function stringToBytes(string) {
            var array = new Uint8Array(string.length);
            for (var i = 0, l = string.length; i < l; i++) {
                array[i] = string.charCodeAt(i);
            }
            return array.buffer;
        }


        function bytesToString(buffer) {
            return String.fromCharCode.apply(null, new Uint8Array(buffer));
        }




        function startScan() {
            var deferred = $q.defer();
            isBusy = true;
            eventsArray = [];

            $timeout(
                function () {
                    stopScan();
                    deferred.resolve();
                }
                , TIMEOUT_MS);

            ble.startScan(
                [],
                function (device) {
                    if (!!device.name) {
                        eventsArray.push({
                            id: device.id,
                            name: device.name
                        });
                    }
                },
                function (error) {
                    console.log("BLE: error " + JSON.stringify(error, null, 2));
                    deferred.reject(error);

                }
            );

            return deferred.promise;
        }

        function stopScan() {
            if (isBusy) {
                isBusy = false;
                ble.stopScan();
            }

        }

        function asyncScan() {
            var deferred = $q.defer();

            if (!isBusy) {
                startScan().then(
                    function () {
                        deferred.resolve();
                    },
                    function () {
                        deferred.reject();
                    }
                );
            } else {
                $timeout(function () {
                    deferred.resolve();
                });
            }

            return deferred.promise;
        }

        // EXAMPLE DETAIL - direct from a connection
        // {
        //   "name": "BLE: Alice DigitalLabs",
        //   "id": "B8:27:EB:C9:49:5D",
        //   "advertising": {},
        //   "rssi": -42,
        //   "services": [
        //     "1800",
        //     "1801",
        //     "25576d0e-7452-4910-900b-1a9f82c19a7d"
        //   ],
        //   "characteristics": [
        //     {
        //       "service": "1800",
        //       "characteristic": "2a00",
        //       "properties": [
        //         "Read"
        //       ]
        //     },
        //     {
        //       "service": "1800",
        //       "characteristic": "2a01",
        //       "properties": [
        //         "Read"
        //       ]
        //     },
        //     {
        //       "service": "1801",
        //       "characteristic": "2a05",
        //       "properties": [
        //         "Indicate"
        //       ],
        //       "descriptors": [
        //         {
        //           "uuid": "2902"
        //         }
        //       ]
        //     },
        //     {
        //       "service": "25576d0e-7452-4910-900b-1a9f82c19a7d",
        //       "characteristic": "a66ae744-46ab-459b-9942-5e502ac21640",
        //       "properties": [
        //         "Read"
        //       ]
        //     },
        //     {
        //       "service": "25576d0e-7452-4910-900b-1a9f82c19a7d",
        //       "characteristic": "4541e38d-7a4c-48a5-b7c8-61a0c1efddd9",
        //       "properties": [
        //         "Read"
        //       ]
        //     },
        //     {
        //       "service": "25576d0e-7452-4910-900b-1a9f82c19a7d",
        //       "characteristic": "fbfa8e9c-c1bd-4659-bbd7-df85c750fe6c",
        //       "properties": [
        //         "Read"
        //       ]
        //     }
        //   ]
        // }
        // EXAMPLE DETAIL OUTPUT service > characteristic > properties
        // {
        //     "1800": {
        //       "2a00": {
        //         "properties": [
        //           "Read"
        //         ]
        //       },
        //       "2a01": {
        //         "properties": [
        //           "Read"
        //         ]
        //       }
        //     },
        //     "1801": {
        //       "2a05": {
        //         "properties": [
        //           "Indicate"
        //         ]
        //       }
        //     },
        //     "25576d0e-7452-4910-900b-1a9f82c19a7d": {
        //       "a66ae744-46ab-459b-9942-5e502ac21640": {
        //         "properties": [
        //           "Read"
        //         ]
        //       },
        //       "4541e38d-7a4c-48a5-b7c8-61a0c1efddd9": {
        //         "properties": [
        //           "Read"
        //         ]
        //       },
        //       "fbfa8e9c-c1bd-4659-bbd7-df85c750fe6c": {
        //         "properties": [
        //           "Read"
        //         ]
        //       }
        //     }
        //   }
        function processDetail(data) {

            var detail = {};

            var characteristics = data.characteristics;
            characteristics.forEach(
                function (item) {
                    if (!detail[item.service]) {
                        detail[item.service] = {};
                    }
                    if (!detail[item.service][item.characteristic]) {
                        detail[item.service][item.characteristic] = {};
                    }
                    if (!detail[item.service][item.characteristic].properties) {
                        detail[item.service][item.characteristic].properties = [];
                    }
                    detail[item.service][item.characteristic].properties =
                        detail[item.service][item.characteristic].properties.concat(item.properties);
                }
            );

            return detail;



        }



        function connectGetDetailDisconnect(id) {
            var deferred = $q.defer();

            if (!isBusy) {
                isBusy = true;
                device_id = id;
                detail = [];


                ble.connect(
                    id,
                    function (data) {
                        console.log(JSON.stringify(data, null, 2));
                        detail = processDetail(data);
                        ble.disconnect(
                            id,
                            function () {
                                isBusy = false;
                                deferred.resolve(detail);
                            },
                            function (error) {
                                isBusy = false;
                                deferred.reject(error);
                            });
                    },
                    function (error) {
                        // assume the device has disconnected.
                        isBusy = false;
                        console.log(JSON.stringify(error, null, 2));
                        deferred.reject(error);
                    });
            } else {
                $timeout(
                    function () {
                        deferred.resolve({});
                    }
                );
            }


            return deferred.promise;

        }


        function attemptMTUChange(device_id) {
            var deferred = $q.defer();


            ble.requestMtu(device_id, REQUESTED_MTU_SIZE_BYTES,
                function mtuSuccess() {
                    console.log("extended MTU size success.");
                    deferred.resolve();
                },
                function mtuFail() {
                    console.log("extended MTU size fail.");
                    deferred.resolve();
                });

            return deferred.promise;
        }

        function createBufferedQuery(device_id, service_id, characteristic_id) {
            var _emergencyExit = null;
            var _started = false;

            var _device_id = device_id;
            var _service_id = service_id;
            var _characteristic_id = characteristic_id;
            var _chunksToGet = null;
            var _chunkCount = 0;
            var _typedArrayHolder = new Uint8Array(0);


            function sendProgress(count, total, callback){
                var progress = 100 * count / total;
                $timeout(function(){
                    callback(progress);
                }
                )};

            function start(progressCallback) {
                if(_started != false){
                    throw("use once, then throw away.");
                }
                _started = true;
                var deferred = $q.defer();
                _emergencyExit = deferred;
                connectSubscribe(
                    _device_id,
                    _service_id,
                    _characteristic_id,
                    function (data) {
                        // first chunk is the number of chunks to come.
                        if (_chunksToGet == null) {
                            _chunksToGet = parseInt(bytesToString(data));
                            _chunkCount = 0;
                            console.log("waiting for: " + _chunksToGet);
                        } else {
                            _chunkCount++;
                            
                            if(_chunkCount <= _chunksToGet){
                                _typedArrayHolder = concatBuffers(_typedArrayHolder,data);
                                sendProgress(_chunkCount,_chunksToGet,progressCallback );
                            }
                            if(_chunkCount >= _chunksToGet){
                                // any further notifications are bad!
                                unsubscribeDisconnect(
                                    _device_id,
                                    _service_id,
                                    _characteristic_id)
                                    .then(
                                        function(){
                                            deferred.resolve(_typedArrayHolder);
                                        }
                                    )
                                    .catch(
                                        function(error){
                                            deferred.reject(error);
                                        }
                                    );
                            }
                        }
                    });
                return deferred.promise;
            }

            function cancel(){
                unsubscribeDisconnect(
                    _device_id,
                    _service_id,
                    _characteristic_id)
                    .then(
                        function(){
                            _emergencyExit.reject("operation cancelled successfully");
                        }
                    )
                    .catch(
                        function(error){
                            _emergencyExit.reject("operation cancelled with errors");
                        }
                    );                
            }



            var result= {
                start: start,
                cancel: cancel
            }
            return result;
        }




        function connectSubscribe(device_id, service_id, characteristic_id, callback) {
            var deferred = $q.defer();

            if (!isBusy) {
                isBusy = true;

                ble.connect(
                    device_id,
                    function (data) {
                        
                        ble.startNotification(device_id, service_id, characteristic_id,
                            function (response) {
                                isSubscribed = true; // this is called every time there is an update.
                                callback(response);
                            },
                            function (error) {
                                // assume the deivice has disconnected.
                                isBusy = false;
                                isSubscribed = false;
                                console.log(JSON.stringify(error, null, 2));
                                deferred.reject(error);
                            });
                    },
                    function (error) {
                        // assume the deivice has disconnected.
                        isBusy = false;
                        isSubscribed = false;
                        console.log(JSON.stringify(error, null, 2));
                        deferred.reject(error);
                    });
            } else {
                $timeout(
                    function () {
                        deferred.resolve({});
                    }
                );
            }
            return deferred.promise;
        }

        function unsubscribeDisconnect(device_id, service_id, characteristic_id) {
            var deferred = $q.defer();
            if (isBusy && isSubscribed) {
                ble.stopNotification(device_id, service_id, characteristic_id,
                    function success() {
                        ble.disconnect(device_id,
                            function () {
                                isBusy = false;
                                isSubscribed = false;
                                deferred.resolve();
                            },
                            function (error) {
                                isBusy = false;
                                isSubscribed = false;
                                deferred.reject(error);
                            });
                        deferred.resolve();

                    },
                    function error(error) {
                        isBusy = false;
                        isSubscribed = false;
                        console.log(JSON.stringify(error, null, 2));
                        deferred.reject(error);
                    });
                    
            } else {
                $timeout(
                    function () {
                        deferred.resolve();
                    }
                );
            }
            return deferred.promise;
        }


        function connectWriteDisconnect(device_id, service_id, characteristic_id, arraybuffer) {
            var deferred = $q.defer();

            if (!isBusy) {
                isBusy = true;

                ble.connect(
                    device_id,
                    function (data) {

                        ble.write(device_id, service_id, characteristic_id, arraybuffer,


                            function (response) {

                                ble.disconnect(
                                    device_id,
                                    function () {
                                        isBusy = false;
                                        deferred.resolve(response);
                                    },
                                    function (error) {
                                        isBusy = false;
                                        deferred.reject(error);
                                    });

                            },
                            function (error) {
                                // assume the deivice has disconnected.
                                isBusy = false;
                                console.log(JSON.stringify(error, null, 2));
                                deferred.reject(error);
                            });
                    },
                    function (error) {
                        // assume the deivice has disconnected.
                        isBusy = false;
                        console.log(JSON.stringify(error, null, 2));
                        deferred.reject(error);
                    });
            } else {
                $timeout(
                    function () {
                        deferred.resolve({});
                    }
                );
            }


            return deferred.promise;

        }

        function connectReadDisconnect(device_id, service_id, characteristic_id) {
            var deferred = $q.defer();

            if (!isBusy) {
                isBusy = true;

                ble.connect(
                    device_id,
                    function (data) {

                        console.log("reading..");
                        ble.read(device_id, service_id, characteristic_id,


                            function (response) {

                                ble.disconnect(
                                    device_id,
                                    function () {
                                        isBusy = false;
                                        deferred.resolve(response);
                                    },
                                    function (error) {
                                        isBusy = false;
                                        deferred.reject(error);
                                    });

                            },
                            function (error) {
                                // assume the deivice has disconnected.
                                isBusy = false;
                                console.log(JSON.stringify(error, null, 2));
                                deferred.reject(error);
                            });
                    },
                    function (error) {
                        // assume the deivice has disconnected.
                        isBusy = false;
                        console.log(JSON.stringify(error, null, 2));
                        deferred.reject(error);
                    });
            } else {
                $timeout(
                    function () {
                        deferred.resolve({});
                    }
                );
            }


            return deferred.promise;

        }



        service.updateEvents = function () {
            return asyncScan();
        }

        function getNames(eventsArray) {
            var result = [];
            eventsArray.forEach(function (event) {
                result.push(event.name);
            });
            return result;
        }


        service.getEvents = function () {
            return getNames(eventsArray);
        }

        service.getNumEvents = function () {
            return eventsArray.length;
        }

        service.selectEventAt = function (index) {
            event = eventsArray[index];
        }

        service.getEvent = function () {
            return event;
        }

        service.attemptMTUChange = function () {
            return attemptMTUChange(event.id);
        }

        service.updateDetail = function () {
            return connectGetDetailDisconnect(event.id);
        }

        service.getServices = function () {
            return Object.keys(detail);
        }

        service.selectService = function (id) {
            service_id = id;
        }

        service.getService = function () {
            return service_id;
        }

        service.getCharacteristics = function () {
            return Object.keys(detail[service_id]);
        }

        service.selectCharacteristic = function (id) {
            characteristic_id = id;
        }

        service.getCharacteristic = function () {
            return characteristic_id;
        }

        service.getProperties = function () {
            return detail[service_id][characteristic_id].properties;
        }

        service.selectProperty = function (value) {
            property = value;
        }

        service.getProperty = function () {
            return property;
        }


        service.connectReadDisconnect = function () {
            return connectReadDisconnect(device_id, service_id, characteristic_id);
        }

        service.connectWriteDisconnect = function (arraybuffer) {
            return connectWriteDisconnect(device_id, service_id, characteristic_id, arraybuffer);
        }


        service.stringToBytes = stringToBytes;
        

        service.bytesToString = bytesToString;

        service.createBufferedQuery = function(){
            return createBufferedQuery(device_id, service_id, characteristic_id);
        }

        return service;

    }


})();