def = {
    init: function(elevators, floors) {
        self.injector_scope = {
            time: 0
        };
        var DEFAULT_ROLE = { type: "r_aid" };
        var PRESS_AGAIN_DELTA = 0.5;
        var ELEVATOR_PRESS_MAX_DELAY = 2.0;
        var ELEVATOR_ROLES_DEF = [];
        var ELEVATOR_ROLES_L13 = [
            { type: "r_aid", home: { dir: 1, floorNum: 0 }, switch_off_indicator_factor: 0.4 },
            { type: "r_aid", home: { dir: 0, floorNum: 1 }, switch_off_indicator_factor: 0.4 },
            { type: "r_aid", home: { dir: 0, floorNum: 3 }, switch_off_indicator_factor: 0.4 },
            { type: "r_aid", home: { dir: 0, floorNum: 5 }, switch_off_indicator_factor: 0.4 },
            { type: "r_aid", home: { dir: 0, floorNum: 7 }, switch_off_indicator_factor: 0.4 }
        ];
        var ELEVATOR_ROLES_L17 = [
            { type: "r_general" },
            { type: "r_general" },
            { type: "r_upstream", always_indicate_down: true },
            { type: "r_upstream", always_indicate_down: true },
            { type: "r_upstream", always_indicate_down: true }
        ];
        var ELEVATOR_ROLES = ELEVATOR_ROLES_L17;
        /* EXAMPLES:
         { type: "r_aid", home: { dir: -1, floorNum: 7 } },
         { type: "r_aid", floorNums: [0, 6, 7, 8] },
         { type: "r_upstream", always_indicate_down: true },
         { type: "r_general", always_indicate_up: true },
         { type: "r_general" },
         { type: "r_upstream" },
         { type: "r_aid" },
         { type: "r_aid", prefer_outbound: true },
         { type: "r_aid", switch_off_indicator_factor: 0.5 },
         */
        var MAX_UPSTREAM_DOWN_COLLECT_FLOOR = Math.floor(floors.length / 2);

        var floorCount = floors.length;
        function spread_indices_to_map(indices, boolArray) {
            for (var i = 0; i < boolArray.length; i++) boolArray[i] = false;
            for (i = 0; i < indices.length; i++) boolArray[indices[i]] = true;
        }
        function array_retain(arr, map) {
            for (var i = 0, j = 0; i < arr.length; i++) {
                if (map[i]) {
                    arr[j] = arr[i];
                    j++;
                }
            }
            arr.length = j;
        }
        function array_fill(arr, value) {
            for (var i = 0; i < arr.length; i++) arr[i] = value;
            return arr;
        }
        function array_copy(src, dst) {
            for (var i = 0; i < src.length; i++) dst[i] = src[i];
            return dst;
        }
        function undefinedOrContains(arr, val) {
            return !arr || (arr.indexOf(val) >= 0);
        }

        function arrayOfFloorsSize(v) {
            return array_fill(new Array(floors.length), v);
        }
        function terminalFloor(dir) {
            return (dir < 0) ? 0 : floors.length - 1;
        }


        ELEVATOR_ROLES.forEach(function(myRole, index) {
            var elevator = elevators[index];
            if (elevator) elevator.myRole = myRole;
        });
        elevators.forEach(function(el, index) {
            if (!el.myRole) el.myRole = DEFAULT_ROLE;
            el.myPressed = arrayOfFloorsSize(false);
            el.myPressedLast = arrayOfFloorsSize(false);
            el.myPressedTime = arrayOfFloorsSize(0);
            el.myPressedOrdered = [];
            el.myTmpArray = arrayOfFloorsSize(null);
            el.myCollectedTime_up = -1;
            el.myCollectedTime_down = -1;
            el.myCollectedNew = false;
            el.myCollectedTimestamp = 0;

            el.myPullPressed = function() {
                var setTo, cf = el.currentFloor(), i, wasPress;
                spread_indices_to_map(el.getPressedFloors(), el.myPressed);

                // If a button has been pressed after a stop within a few seconds
                // interpret it as the new man got inside pressed that,
                // inherit it's wait time
                if (self.injector_scope.time - el.myCollectedTimestamp < ELEVATOR_PRESS_MAX_DELAY) {
                    wasPress = false;
                    for (i = 0; i < floorCount; i++) {
                        if (el.myPressed[i] && !el.myPressedLast[i]) {
                            if (!wasPress) {
//                                console.warn('PressedButton');
                                wasPress = true;
                            }
                            setTo = (i > cf) ? el.myCollectedTime_up : el.myCollectedTime_down;
                            if (setTo < 0) setTo = self.injector_scope.time;
                            el.myPressedTime[i] = setTo;
                        }
                    }
                } else {
                    if (el.myCollectedNew) {
//                        console.warn('DidntPressButton');
                        el.myCollectedNew = false;
                        for (i = 0; i < floorCount; i++) {
                            if (el.myPressed[i]) {
                                setTo = (i > cf) ? el.myCollectedTime_up : el.myCollectedTime_down;
                                if (setTo >= 0) {
                                    if (el.myPressedLast[i]) {
                                        setTo = Math.min(setTo, el.myPressedTime[i]);
                                    }
                                    el.myPressedTime[i] = setTo;
                                }
                            }
                        }
                    } else {
                        wasPress = false;
                        for (i = 0; i < floorCount; i++) {
                            if (el.myPressed[i] && !el.myPressedLast[i]) {
                                // We don't know what happened, someone pressed a button in a random time
                                if (!wasPress) {
                                    console.warn('UnexpectedButtonPress');
                                    wasPress = true;
                                }
                                el.myPressedTime[i] = self.injector_scope.time;
                            }
                        }
                    }
                }

                array_copy(el.myPressed, el.myPressedLast);
                array_retain(el.myPressedOrdered, el.myPressed);
                spread_indices_to_map(el.myPressedOrdered, el.myTmpArray);
                for (i = 0; i < floorCount; i++) {
                    if (!el.myTmpArray[i] && el.myPressed[i]) {
                        el.myPressedOrdered.push(i);
                    }
                }

            };
            el.myUpdateIndicators = function() {
                var ifactor = el.myRole.switch_off_indicator_factor;
                if ((ifactor !== undefined) && (el.loadFactor() > ifactor)) {
                    el.goingUpIndicator(false);
                    el.goingDownIndicator(false);
                } else {
                    el.goingUpIndicator(el.myRole.always_indicate_up || (el.myfDir >= 0));
                    el.goingDownIndicator(el.myRole.always_indicate_down || (el.myfDir <= 0));
                }
            };
            el.myIndicator = function(dir, val) {
                if (val === undefined) {
                    return (dir > 0) ? el.goingUpIndicator() : el.goingDownIndicator();
                } else {
                    return (dir > 0) ? el.goingUpIndicator(val) : el.goingDownIndicator(val);
                }
            };
            el.myDir = function(val) {
                if (val === undefined) {
                    return el.myfDir;
                } else if (el.myfDir !== val) {
                    el.myfDir = val;
                    el.myUpdateIndicators();
                }
            };
            el.myIsFull = function() {
                return ((1 - el.loadFactor()) * el.maxPassengerCount()) < 1;
            };
            el.myDir(1);
            el.myChangeDir = function() {
                el.myDir((el.myfDir > 0) ? -1 : 1);
            };

            el.myShallPickup = function(i, dir) {
                var floor = floors[i];
                return !el.myIsFull() && floor.myButton(dir) && !floor.myTargeted(dir) && undefinedOrContains(el.myRole.floorNums, i);
            };
            var EPSILON = 0.1;
            el.myOldestPressed = function(timeUpperBound) {
                var cf = el.currentFloor();
                var res = -1;
                for (var i = 0; i < floorCount; i++) {
                    var pt = el.myPressedTime[i];
                    if (
                        el.myPressed[i]
                        &&
                        (
                            (timeUpperBound === undefined)
                            ||
                            (pt < timeUpperBound - EPSILON)
                            ||
                            (
                                (res >= 0)
                                &&
                                (pt < timeUpperBound + EPSILON)
                                &&
                                (Math.abs(cf - i) < Math.abs(cf - res))
                            )
                        )
                    ) {
                        res = i;
                        timeUpperBound = pt;
                    }
                }
                // console.log(res);
                return (res >= 0) ? { floorNum: res, time: timeUpperBound } : null;
            };

            function longestWaiting(dir, floorNums) {
                var up = (dir >= 0), down = (dir <= 0);
                var res = -1, resTime = 1e9, resDir = 0;
                for (var i = 0; i < floors.length; i++) {
                    if (undefinedOrContains(floorNums, i)) {
                        var floor = floors[i];
                        if (up && floor.myfButton_up && !floor.myfTargeted_up && (floor.myfButtonTime_up < resTime)) {
                            resTime = floor.myfButtonTime_up;
                            res = i;
                            resDir = 1;
                        }
                        if (down && floor.myfButton_down && !floor.myfTargeted_down && (floor.myfButtonTime_down < resTime)) {
                            resTime = floor.myfButtonTime_down;
                            res = i;
                            resDir = -1;
                        }
                    }
                }
                return (res >= 0) ? {
                    floorNum: res,
                    dir: resDir,
                    time: resTime
                } : null;
            }


            function r_general_helper(el, cf, strt) {
                for (var i = strt; i >= 0 && i < floors.length; i += el.myfDir) {
                    if (el.myShallPickup(i, el.myfDir) || el.myPressed[i]) {
                        return [i];
                    }
                }
                return null;
            }
            function r_aid_put_them_down(el, cf) {
                var res = el.myOldestPressed();
                return res ? [res.floorNum] : null;
            }

            var role_fallback = {
                r_general: function(el, cf) {
                    el.myChangeDir();
                    return [terminalFloor(-el.myfDir)];
                },
                r_aid: function(el, cf) {
                    var home = el.myRole.home;
                    if (home) {
                        el.myDir(home.dir);
                        return [home.floorNum];
                    } else {
                        el.myDir(1);
                        return [0];
                    }
                },
                r_upstream: function(el, cf) {
                    return null;
                }
            };
            var role_strategies = {
                r_general: function(el, cf, plan) {
                    if (!plan) {
                        plan = r_general_helper(el, cf, cf + el.myfDir);
                    }
                    if (!plan) {
                        el.myChangeDir();
                        plan = r_general_helper(el, cf, terminalFloor(-el.myfDir));
                    }
                    return plan;
                },
                r_aid: function(el, cf, plan) {
                    if (!plan) {
                        if (el.myIsFull() || el.myRole.prefer_outbound) {
                            plan = r_aid_put_them_down(el, cf);
                        }
                    }
                    if (!plan) {
                        var longestWaitingResult = longestWaiting(0, el.myRole.floorNums);
                        if (longestWaitingResult) {
                            var myOldestPressedResult = el.myOldestPressed(longestWaitingResult.time);
                            if (myOldestPressedResult) {
                                el.myDir(0);
                                plan = [myOldestPressedResult.floorNum];
                            } else {
                                el.myDir(longestWaitingResult.dir);
                                plan = [longestWaitingResult.floorNum];
                            }
                        }
                    }
                    if (!plan) {
                        plan = r_aid_put_them_down(el, cf);
                    }
                    return plan;
                },
                r_upstream: function(el, cf, plan) {
                    var i;
                    if (!plan && el.myfDir > 0) {
                        if (!plan) {
                            for (i = cf + 1; i < floors.length; i++) {
                                if (el.myPressed[i]) {
                                    plan = [i];
                                    break;
                                }
                            }
                        }
                        if (!plan && (cf === 0)) {
                            for (i = 1; (i < floors.length) && (i < MAX_UPSTREAM_DOWN_COLLECT_FLOOR); i++) {
                                if (el.myShallPickup(i, -1)) {
                                    plan = [i];
                                    el.myDir(-1);
                                    break;
                                }
                            }
                        }
                    }
                    if (!plan) {
                        if ((el.myDir() > 0) && (cf > 0)) {
                            el.myDir(-1);
                            plan = [cf];
                        } else {
                            for (i = cf - 1; i > 0; i--) {
                                if (el.myPressed[i]) {
                                    plan = [i];
                                    break;
                                }
                            }
                            if (!plan) plan = [0];
                            if (plan[0] === 0) el.myDir(1);
                        }
                    }
                    return plan;
                }
            };

            function determinePlan(el) {
                var cf = el.currentFloor();
                var plan = role_strategies[el.myRole.type](el, cf, null);
                if (!plan) {
                    plan = role_fallback[el.myRole.type](el, cf);
                }
                return plan;
            }
            // el.goToFloor(Math.round(index * (floors.length - 1) / (elevators.length - 1)));
            el.on("idle", function() {
                el.myPullPressed();
                var plan = determinePlan(el);
                if (plan && (plan.length > 0)) {
                    plan.forEach(function (i) {
                        if (el.goingUpIndicator()) floors[i].myfTargeted_up++;
                        if (el.goingDownIndicator()) floors[i].myfTargeted_down++;
                        //console.log([floors[i].myfTargeted_down,floors[i].myfTargeted_up]);
                        // console.log("[" + index + "] goto: " + i + "(" + el.myfDir + ")");
                        el.goToFloor(i);
                    });
                } else {
                    throw new Error('Must provide a plan');
                }
            });
            el.on("passing_floor", function (fn, dir) {
                el.myPullPressed();
            });
            el.on('floor_button_pressed', function(fn) {
                // el.myPressed[fn] = true;
            });
            el.on('stopped_at_floor', function(fn) {
                // console.log("[" + index + "] stpd: " + fn + "(" + el.dir + ")");
                var floor = floors[fn];
                el.myCollectedNew = (floor.myfButton_up && el.goingUpIndicator()) || (floor.myfButton_down && el.goingDownIndicator());
                el.myCollectedTimestamp = self.injector_scope.time;
                el.myCollectedTime_up = floor.myfButton_up ? floor.myfButtonTime_up : -1;
                el.myCollectedTime_down = floor.myfButton_down ? floor.myfButtonTime_down : -1;
                // el.myPressed[fn] = false;
                for (var dir = -1; dir < 2; dir += 2) {
                    if (el.myIndicator(dir)) {
                        floor.myButton(dir, false);
                        floor.myTargeted(dir, 0);
                        floor.myLastVisited(dir, self.injector_scope.time);
                    }
                }
            });
        });

        floors.forEach(function(fl, index) {
            fl.myDirval = function(prefix, dir, val) {
                var field = prefix + ((dir < 0) ? "down" : "up");
                if (val === undefined) {
                    return fl[field];
                } else {
                    fl[field] = val;
                }
            };
            fl.myButton = function(dir, val) {
                return fl.myDirval("myfButton_", dir, val);
            };
            fl.myButtonTime = function(dir, val) {
                return fl.myDirval("myfButtonTime_", dir, val);
            };
            fl.myButtonDelta = function(dir) {
                return self.injector_scope.time - fl.myButtonTime(dir);
            };
            fl.myTargeted = function(dir, val) {
                return fl.myDirval("myfTargeted_", dir, val);
            };
            fl.myLastVisited = function(dir, val) {
                return fl.myDirval("myfLastVisited_", dir, val);
            };
            fl.myfTargeted_up = 0;
            fl.myfTargeted_down = 0;
            fl.myfButton_up = false;
            fl.myfButton_down = false;
            fl.myfButtonTime_up = 0;
            fl.myfButtonTime_down = 0;
            fl.myfLastVisited_up = -1e9;
            fl.myfLastVisited_down = -1e9;
            fl.on('up_button_pressed', function () {
                if (!fl.myfButton_up) {
                    if ((self.injector_scope.time - fl.myfLastVisited_up) > PRESS_AGAIN_DELTA) {
                        fl.myfButtonTime_up = self.injector_scope.time;
                    }
                }
                fl.myfButton_up = true;
            });
            fl.on('down_button_pressed', function () {
                if (!fl.myfButton_down) {
                    if ((self.injector_scope.time - fl.myfLastVisited_down) > PRESS_AGAIN_DELTA) {
                        fl.myfButtonTime_down = self.injector_scope.time;
                    }
                }
                fl.myfButton_down = true;
            });
        });
    },
    update: function(dt, elevators, floors) {
        self.injector_scope.time += dt;
        elevators.forEach(function(el) {
            el.myUpdateIndicators();
            el.myPullPressed();
            var tag = '' + el.myRole.type + '\n', time = self.injector_scope;
            el.getPressedFloors().reverse().forEach(function(fn) {
               tag += '' + fn + ': ' + (self.injector_scope.time - el.myPressedTime[fn]).toFixed(1) + '\n';
            });
            el.$$tag = tag;
        });

    }
}

