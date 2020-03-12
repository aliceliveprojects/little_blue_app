(function () {
    'use strict';

    angular
        .module('eventsjs')
        .controller('level3DetailCtrl', control);

    control.$inject = [
        '$state',
        'eventsSrvc'
    ];

    function control(
        $state,
        eventsSrvc
    ) {
        var vm = angular.extend(this, {
            id: 'no  id',
            name: 'no name',
            service_id: 'no service_id',
            characteristic_id: 'no characteristic id',
            items: [],
            responses: [],
            busy: false,
            hasItems: false,
            hasResponses: false,
            indexToEdit : -1,
            valueToWrite : "/"

        });

        vm.sendValue = function(){

            
                vm.busy = true;
                var jsonToWrite = {value: vm.valueToWrite.trim()};
                var bufferToWrite = eventsSrvc.stringToBytes(JSON.stringify(jsonToWrite));
                
                eventsSrvc.connectWriteDisconnect(bufferToWrite)
                .then(
                    function(response){
                        var decoded = eventsSrvc.bytesToString(response);
                        vm.responses.push(decoded);
                        vm.hasResponses = true;
                        vm.busy = false;
                    }
                )
                .catch(function (error) {
                    console.log(JSON.stringify(error, null, 2));
                    vm.busy = false;
                });
            

        }

        vm.onItemSelected = function (index) {
            var property = vm.items[index];
            eventsSrvc.selectProperty(property);

            if (property == "Read") {
                vm.indexForEdit = -1;
                if (!vm.busy) {
                    vm.busy = true;
                    eventsSrvc.connectReadDisconnect()
                        .then(function (response) {

                            var decoded = eventsSrvc.bytesToString(response);
                            vm.responses.push(decoded);
                            vm.hasResponses = true;
                            vm.busy = false;
                        })
                        .catch(function (error) {
                            console.log(JSON.stringify(error, null, 2));
                            vm.busy = false;
                        });
                }
            }else if(property == "Write"){
                vm.indexForEdit = index;
                vm.valueToWrite = "/";
            }else if(property == "Notify"){
                vm.indexForEdit = -1;
                if (!vm.busy) {
                    vm.busy = true;
                    var bufferedQuery = eventsSrvc.createBufferedQuery();

                    bufferedQuery.start(function(progress){
                        console.log(progress);
                    }).then(function (response) {
                            var decoded = eventsSrvc.bytesToString(response);
                            vm.responses.push(decoded);
                            vm.hasResponses = true;
                            vm.busy = false;
                        })
                        .catch(function (error) {
                            console.log(JSON.stringify(error, null, 2));
                            vm.busy = false;
                        });
                    }
            }

        }

        vm.done = function () {
            $state.go('level_2_detail');
        }

        var event = eventsSrvc.getEvent();
        vm.name = event.name;
        vm.id = event.id;
        vm.service_id = eventsSrvc.getService();
        vm.characteristic_id = eventsSrvc.getCharacteristic();
        vm.items = eventsSrvc.getProperties();
        vm.hasItems = vm.items.length > 0;
        vm.indexForEdit = -1;
    }
})();
