def= {
    init: function (elevators, floors) {
        var scope = self.scope = {};

        scope.warn = function warn(msg) {
            console.warn(msg);
            console.warn(new Error());
        };
        scope.logState = function () {
            console.log('');
            for (var i = scope.floors.count - 1; i >= 0; i--) {
                console.log([scope.floors.people.up[i], scope.floors.people.down[i]]);

            }
        };

        scope.startFloor = function startFloor(dir) {
            return (dir > 0) ? 0 : floors.length - 1;
        };
        scope.floorArr = function floorArr(val) {
            var a = [];
            for (var i = 0; i < floors.length; i++) a.push(val);
            return a;
        };
        scope.Floor = function($owner) {
            this.$owner = $owner;
            this.floorNum = $owner.floorNum();
            this.targeted = { up: 0, down: 0 };
            this.people = { up: 0, down: 0 };
        };
        // $scoep.Floor.prototype.

        scope.Elevator = function ($owner) {
            this.$owner = $owner;
            this.direction = -1;
            this.lastDirection = -1;
            this.lastPassengerCount = 0;
            this.dest = scope.floorArr(0);
            this.working = false;
            this.schedule = {
                has: false,
                left: 0
            };
        };

        scope.Elevator.prototype.doSchedule = function doSchedule(delay) {
            if (this.working) scope.warn('doSchedule');
            this.schedule.has = true;
            this.schedule.left = delay;
        };
        scope.Elevator.prototype.fireSchedule = function fireSchedule() {
            this.postStopped();
        };

        scope.Elevator.prototype.tick = function tick(dt) {
            if (this.schedule.has) {
                this.schedule.left -= dt;
                // console.log(this.schedule.left);
                if (this.schedule.left <= 0) {
                    this.schedule.has = false;
                    this.fireSchedule();
                }
            }
        };
        scope.Elevator.prototype.postStopped = function postStopped() {
            var floorNum = this.$owner.currentFloor();
            var elevator = this.$owner;
            var delta = this.processPassangerDelta();
            var estimatedPassengerCount = this.estimatePassengerCount();
            var estimatedSpaceInElevator = elevator.maxPassengerCount() - estimatedPassengerCount;
            if (estimatedSpaceInElevator > 0) {
                scope.floors.usePeople(floorNum, this.direction, estimatedSpaceInElevator);
            }
            scope.floors.setTargeted(floorNum, this.direction, null);
            this.safeRefresh('postStopped');
            this.registerLastDirection();
            console.log('f: ' + floorNum + ' d: ' + delta + ' e: ' + estimatedPassengerCount + '/' + elevator.maxPassengerCount());
        };
        scope.Elevator.prototype.init = function init() {
            var _this = this;
            var elevator = this.$owner;

            this.direction = -1;
            this.changeDirection();

            elevator.on("idle", function () {
            });
            elevator.on("floor_button_pressed", function (floorNum) {
                _this.dest[floorNum]++;
            });
            elevator.on("passing_floor", function (floorNum, direction) {
            });
            elevator.on("stopped_at_floor", function (floorNum) {
                _this.working = false;
                _this.emptyFloor(floorNum);
                _this.doSchedule(0.5);
            });
        };
        scope.Elevator.prototype.emptyFloor = function (floor) {
            var result = this.dest[floor];
            this.dest[floor] = 0;
            return result;
        };
        scope.Elevator.prototype.goToFloor = function (floor) {
            if (this.$owner.destinationQueue.length > 0) scope.warn('goToFloor.queue');
            if (this.working) scope.warn('goToFloor.working');
            if (this.schedule.has) scope.warn('goToFloor.scheduled');
            this.working = true;
            this.$owner.goToFloor(floor);
        };
        scope.Elevator.prototype.searchDestination = function (startFloor) {
            var pressed = this.getPressedMap();
            for (var i = startFloor; i >= 0 && i < floors.length; i += this.direction) {
                if (
                    (
                    (scope.floors.getPeople(i, this.direction) > 0)
                    &&
                    (!scope.floors.getTargeted(i, this.direction)
                    )
                    ||
                    pressed[i]
                    )
                ) {
                    scope.floors.setTargeted(i, this.direction, this);
                    this.goToFloor(i);
                    return true;
                }
            }
            return false;
        };
        scope.Elevator.prototype.refresh = function refresh() {
            if (this.working) scope.warn('refresh.working');

            if (this.searchDestination(this.$owner.currentFloor() + this.direction)) return true;
            this.changeDirection();
            if (this.searchDestination(scope.startFloor(this.direction))) return true;
            this.goToFloor(this.$owner.currentFloor());
            return false;
        };
        scope.Elevator.prototype.safeRefresh = function safeRefresh(warnMsg) {
            var elevator = this.$owner, canRefresh = true;

            if (elevator.destinationQueue.length > 0) {
                // if (warnMsg) scope.warn('safeRefresh.destinationQueue: ' + warnMsg);
                canRefresh = false;
            }
            if (this.working) {
                // if (warnMsg) scope.warn('safeRefresh.working: ' + warnMsg);
                // if (warnMsg === 'postStopped') scope.warn(new Error().stack);
                canRefresh = false;
            }
            if (this.schedule.has) {
                // if (warnMsg) scope.warn('safeRefresh.schedule: ' + warnMsg);
                // if (warnMsg === 'postStopped') scope.warn(new Error().stack);
                canRefresh = false;
            }

            if (canRefresh) {
                this.refresh();
            }
        };
        scope.Elevator.prototype.registerLastDirection = function registerLastDirection() {
            this.$owner.goingUpIndicator(this.lastDirection > 0);
            this.$owner.goingDownIndicator(this.lastDirection < 0);
            this.lastDirection = this.direction;
        };
        scope.Elevator.prototype.changeDirection = function changeDirection() {
            this.direction = -this.direction;
        };

        scope.Elevator.prototype.processPassangerDelta = function processPassangerDelta() {
            var estimate = this.estimatePassengerCount();
            var result = estimate - this.lastPassengerCount;
            this.lastPassengerCount = estimate;
            return result;
        };

        scope.Elevator.prototype.getPressedMap = function getPressedMap() {
            var elevator = this.$owner;
            var pressed = {};
            elevator.getPressedFloors().forEach(function (i) {
                pressed[i] = true;
            });
            return pressed;
        };

        scope.Elevator.prototype.estimatePassengerCount = function estimatePassengerCount() {
            var elevator = this.$owner;
            return Math.round(elevator.maxPassengerCount() * elevator.loadFactor());
        };


        scope.floors = {};
        scope.floors.count = floors.length;
        scope.floors.people = {
            up: scope.floorArr(0),
            down: scope.floorArr(0)
        };
        scope.floors.targeted = {
            up: scope.floorArr(null),
            down: scope.floorArr(null)
        };
        scope.dirMember = function (obj, dir) {
            return (dir > 0) ? obj.up : obj.down;
        };
        scope.floors.getTargeted = function (floor, dir) {
            return scope.dirMember(scope.floors.targeted, dir)[floor];
        };
        scope.floors.setTargeted = function (floor, dir, val) {
            // custom logic: always stop at the bottom floor
            if (floor === 0) return;
            // generic logic
            var a = scope.dirMember(scope.floors.targeted, dir);
            var result = a[floor];
            a[floor] = val;
            return result;
        };

        scope.floors.getPeople = function (floor, dir) {
            return scope.dirMember(scope.floors.people, dir)[floor];
        };
        scope.floors.addPeople = function (floor, dir, delta) {
            var a = scope.dirMember(scope.floors.people, dir);
            a[floor] = Math.max(a[floor] + delta, 0);
        };
        scope.floors.usePeople = function (floor, dir, delta) {
            var a = scope.dirMember(scope.floors.people, dir);
            a[floor] = Math.max(a[floor] - delta, 0);
        };
        scope.floors.setPeople = function (floor, dir, val) {
            var a = scope.dirMember(scope.floors.people, dir);
            a[floor] = val;
        };
        scope.floors.getAllPeople = function (floor) {
            var people = scope.floors.people;
            return people.up[floor] + people.down[floor];
        };

        function unboundSafeRefresh(elevator) {
            elevator.hege.safeRefresh(/*'floorButtonPressed'*/);
        }

        floors.forEach(function (floor) {
            floor.hege = new scope.Floor(floor);
            floor.on('up_button_pressed', function () {
                floor.hege.addPeople(1, 1);
                scope.floors.addPeople(floor.floorNum(), 1, 1);
                elevators.forEach(unboundSafeRefresh);
            });
            floor.on('down_button_pressed', function () {
                scope.floors.addPeople(floor.floorNum(), -1, 1);
                elevators.forEach(unboundSafeRefresh);
            });
        });

        elevators.forEach(function (elevator) {
            elevator.hege = new scope.Elevator(elevator);
            elevator.hege.init();
        });
    },
    update: function (dt, elevators, floors) {
        elevators.forEach(function (elevator) {
            elevator.hege.tick(dt);
        });
    }
}
