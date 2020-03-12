(function () {
    'use strict';

    angular
        .module('eventsjs')
        .controller('eventsListCtrl', control);

    control.$inject = [
        '$state',
        'eventsSrvc'
        ];
    
    function control(
        $state,
        eventsSrvc
    ) {
        var vm = angular.extend(this, {
            events : [],
            hasEvents : false,
            busy: false

         });
        

        

        function getEvents(){
            vm.events = eventsSrvc.getEvents();
            vm.hasEvents = vm.events.length != 0;
        }

        function onNewEvents(){
            vm.busy = false;
            getEvents();
        }

        function onError(error){
            vm.busy = false;
            console.log(`Error: ${JSON.stringify(error)}`);
        }


        function updateEvents(){
            vm.busy = true;
            eventsSrvc.updateEvents()
            .then(onNewEvents)
            .catch(onError)   
        }

        
        vm.onItemSelected = function(index){
            console.log("Item : " + index);
            eventsSrvc.selectEventAt(index);
            //eventsSrvc.attemptMTUChange().then(//always resolves.
            //    function(){
                    $state.go('events_detail');                    
            //    }
            //);
        }


        vm.update = function(){
            updateEvents();
        }

        getEvents();

        
            
    }
})();
