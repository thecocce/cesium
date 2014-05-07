/*global define*/
define([
        '../../Core/defaultValue',
        '../../Core/defined',
        '../../Core/defineProperties',
        '../../Core/destroyObject',
        '../../Core/DeveloperError',
        '../../Core/Event',
        '../../Core/getTimestamp',
        '../../Core/redirectToUrl',
        '../createCommand',
        '../../ThirdParty/knockout'
    ], function(
        defaultValue,
        defined,
        defineProperties,
        destroyObject,
        DeveloperError,
        Event,
        getTimestamp,
        redirectToUrl,
        createCommand,
        knockout) {
    "use strict";

    /**
     * The view model for {@link PerformanceWatchdog}.
     *
     * @alias PerformanceWatchdogViewModel
     * @constructor
     *
     * @param {Scene} scene The Scene instance for which to monitor performance.
     * @param {Function} [lowFrameRateCallback] A function to call when a low frame rate is detected.  The function will be passed
     *        the {@link Scene} instance as its only parameter.
     * @param {String} [lowFrameRateMessage='This application appears to be performing poorly on your system.  Please try using a different web browser or updating your video drivers.'] The
     *        message to display when a low frame rate is detected.  This string will be interpreted as HTML.
     * @param {String} [redirectOnErrorUrl] The URL to which to redirect (by setting window.location.href) when an error occurs during
     *        rendering.  This can be used to automatically redirect to a simpler version of the application when an inadequate web
     *        browser or GPU driver causes an error.  If this parameter is not specified, no automatic redirection happens.
     * @param {String} [redirectOnLowFrameRateUrl] The URL to which to redirect (by setting window.location.href) when a low frame rate
     *        condition is detected.  The exact definition of a low frame rate is specified by other parameters to this constructor.
     *        If this parameter is not specified, no automatic redirection happens.
     * @param {Number} [samplingWindow=5000] The length of the sliding window over which to compute the average frame rate, in milliseconds.
     * @param {Number} [quietPeriod=2000] The length of time to wait at startup and each time the page becomes visible (i.e. when the user
     *        switches back to the tab) before starting to measure performance, in milliseconds.
     * @param {Number} [warmupPeriod=5000] The length of the warmup period, in milliseconds.  During the warmup period, a separate
     *        (usually lower) frame rate is required.
     * @param {Number} [minimumFrameRateDuringWarmup=4] The minimum frames-per-second that are required for acceptable performance during
     *        the warmup period.  If the frame rate averages less than this during any samplingWindow during the warmupPeriod, the
     *        lowFrameRate event will be raised and the page will redirect to the redirectOnLowFrameRateUrl, if any.
     * @param {Number} [minimumFrameRateAfterWarmup=8] The minimum frames-per-second that are required for acceptable performance after
     *        the end of the warmup period.  If the frame rate averages less than this during any samplingWindow after the warmupPeriod, the
     *        lowFrameRate event will be raised and the page will redirect to the redirectOnLowFrameRateUrl, if any.
     */
    var PerformanceWatchdogViewModel = function(description) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(description) || !defined(description.scene)) {
            throw new DeveloperError('description.scene is required.');
        }
        //>>includeEnd('debug');

        this._scene = description.scene;

        this._lowFrameRate = new Event();
        if (defined(description.lowFrameRateCallback)) {
            this._lowFrameRate.addEventListener(description.lowFrameRateCallback);
        }

        /**
         * Gets or sets the URL to which to redirect (by setting window.location.href) when a low frame rate
         * condition is detected.  The exact definition of a low frame rate is specified by other properties.
         * If this parameter is undefined, no automatic redirection happens.
         * @type {String}
         */
        this.redirectOnErrorUrl = description.redirectOnErrorUrl;

        /**
         * Gets or sets the URL to which to redirect (by setting window.location.href) when an error occurs during
         * rendering.  This can be used to automatically redirect to a simpler version of the application when an inadequate web
         * browser or GPU driver causes an error.  If this parameter is undefined, no automatic redirection happens.
         * @type {String}
         */
        this.redirectOnLowFrameRateUrl = description.redirectOnLowFrameRateUrl;

        /**
         * Gets or sets the message to display when a low frame rate is detected.  This string will be interpreted as HTML.
         * @type {String}
         */
        this.lowFrameRateMessage = defaultValue(description.lowFrameRateMessage, 'This application appears to be performing poorly on your system.  Please try using a different web browser or updating your video drivers.');

        /**
         * Gets or sets the length of the sliding window over which to compute the average frame rate, in milliseconds.
         * @type {Number}
         */
        this.samplingWindow = defaultValue(description.samplingWindow, 5000);

        /**
         * Gets or sets the length of time to wait at startup and each time the page becomes visible (i.e. when the user
         * switches back to the tab) before starting to measure performance, in milliseconds.
         * @type {Number}
         */
        this.quietPeriod = defaultValue(description.quietPeriod, 2000);

        /**
         * Gets or sets the length of the warmup period, in milliseconds.  During the warmup period, a separate
         * (usually lower) frame rate is required.
         * @type {Number}
         */
        this.warmupPeriod = defaultValue(description.warmupPeriod, 5000);

        /**
         * Gets or sets the minimum frames-per-second that are required for acceptable performance during
         * the warmup period.  If the frame rate averages less than this during any <code>samplingWindow</code> during the <code>warmupPeriod</code>, the
         * <code>lowFrameRate</code> event will be raised and the page will redirect to the <code>redirectOnLowFrameRateUrl</code>, if any.
         * @type {Number}
         */
        this.minimumFrameRateDuringWarmup = defaultValue(description.minimumFrameRateDuringWarmup, 4);

        /**
         * Gets or sets the minimum frames-per-second that are required for acceptable performance after
         * the end of the warmup period.  If the frame rate averages less than this during any <code>samplingWindow</code> after the <code>warmupPeriod</code>, the
         * <code>lowFrameRate</code> event will be raised and the page will redirect to the <code>redirectOnLowFrameRateUrl</code>, if any.
         * @type {Number}
         */
        this.minimumFrameRateAfterWarmup = defaultValue(description.minimumFrameRateAfterWarmup, 8);

        /**
         * Gets or sets a value indicating whether the low frame rate message has previously been dismissed by the user.  Once it is
         * dismissed, the message will not be redisplayed, no matter the frame rate.
         * @type {Boolean}
         */
        this.lowFrameRateMessageDismissed = false;

        /**
         * Gets or sets a value indicating whether the low frame rate message is currently being displayed.
         * @type {Boolean}
         */
        this.showingLowFrameRateMessage = false;

        this._frameTimes = [];
        this._needsQuietPeriod = true;
        this._quietPeriodEndTime = 0.0;
        this._warmupPeriodEndTime = 0.0;

        this._hiddenPropertyName = defined(document.hidden) ? 'hidden' :
                                   defined(document.mozHidden) ? 'mozHidden' :
                                   defined(document.msHidden) ? 'msHidden' :
                                   defined(document.webkitHidden) ? 'webkitHidden' : 'hiddenNotSupported';

        var that = this;
        this._dismissMessage = createCommand(function() {
            that.showingLowFrameRateMessage = false;
            that.lowFrameRateMessageDismissed = true;
        });

        knockout.track(this, [
            'redirectOnErrorUrl', 'redirectOnLowFrameRateUrl', 'errorMessage', 'lowFrameRateMessage', 'samplingWindow',
            'quietPeriod', 'warmupPeriod', 'minimumFrameRateDuringWarmup', 'minimumFrameRateAfterWarmup', 'lowFrameRateMessageDismissed',
            'showingLowFrameRateMessage', 'showingErrorMessage']);

        this._preRenderRemoveListener = this._scene.preRender.addEventListener(function(scene, time) {
            update(that, time);
        });

        this._renderErrorRemoveListener = this._scene.renderError.addEventListener(function(scene, error) {
            if (defined(that.redirectOnErrorUrl)) {
                redirectToUrl(that.redirectOnErrorUrl);
            }
        });

        var visibilityChangeEventName = defined(document.hidden) ? 'visibilitychange' :
            defined(document.mozHidden) ? 'mozvisibilitychange' :
            defined(document.msHidden) ? 'msvisibilitychange' :
            defined(document.webkitHidden) ? 'webkitvisibilitychange' : undefined;

        function visibilityChangeListener() {
            visibilityChanged(that);
        }

        document.addEventListener(visibilityChangeEventName, this._visibilityChangeListener, false);

        this._visibilityChangeRemoveListener = function() {
            document.removeEventListener(visibilityChangeEventName, visibilityChangeListener, false);
        };
    };

    defineProperties(PerformanceWatchdogViewModel.prototype, {
        /**
         * Gets the {@link Scene} instance for which to monitor performance.
         * @memberof PerformanceWatchdogViewModel.prototype
         * @type {Scene}
         */
        scene : {
            get : function() {
                return this._scene;
            }
        },

        /**
         * Gets the event that is raised when a low frame rate is detected.  The function will be passed
         * the {@link Scene} instance as its only parameter.
         * @memberof PerformanceWatchdogViewModel.prototype
         * @type {Event}
         */
        lowFrameRate : {
            get : function() {
                return this._lowFrameRate;
            }
        },

        /**
         * Gets a command that dismisses the low frame rate message.  Once it is dismissed, the message
         * will not be redisplayed.
         * @memberof PerformanceWatchdogViewModel.prototype
         * @type {Command}
         */
        dismissMessage : {
            get : function() {
                return this._dismissMessage;
            }
        }
    });

    PerformanceWatchdogViewModel.prototype.destroy = function() {
        this._preRenderRemoveListener();
        this._renderErrorRemoveListener();
        this._visibilityChangeRemoveListener();

        return destroyObject(this);
    };

    function update(viewModel, time) {
        if (!shouldDoPerformanceTracking(viewModel)) {
            return;
        }

        var timeStamp = getTimestamp();

        if (viewModel._needsQuietPeriod) {
            viewModel._needsQuietPeriod = false;
            viewModel._frameTimes.length = 0;
            viewModel._quietPeriodEndTime = timeStamp + viewModel.quietPeriod;
            viewModel._warmupPeriodEndTime = viewModel._quietPeriodEndTime + viewModel.warmupPeriod + viewModel.samplingWindow;
        } else if (timeStamp >= viewModel._quietPeriodEndTime) {
            viewModel._frameTimes.push(timeStamp);

            var beginningOfWindow = timeStamp - viewModel.samplingWindow;

            if (viewModel._frameTimes.length >= 2 && viewModel._frameTimes[0] <= beginningOfWindow) {
                while (viewModel._frameTimes.length >= 2 && viewModel._frameTimes[1] < beginningOfWindow) {
                    viewModel._frameTimes.shift();
                }

                var averageTimeBetweenFrames = (timeStamp - viewModel._frameTimes[0]) / (viewModel._frameTimes.length - 1);

                var maximumFrameTime = 1000.0 / (timeStamp > viewModel._warmupPeriodEndTime ? viewModel.minimumFrameRateAfterWarmup : viewModel.minimumFrameRateDuringWarmup);
                if (averageTimeBetweenFrames > maximumFrameTime) {
                    viewModel.lowFrameRate.raiseEvent(viewModel.scene);

                    if (defined(viewModel.redirectOnLowFrameRateUrl)) {
                        redirectToUrl(viewModel.redirectOnLowFrameRateUrl);
                    } else {
                        if (defined(viewModel.lowFrameRateCallback)) {
                            viewModel.lowFrameRateCallback(viewModel._scene);
                        }

                        if (defined(viewModel.lowFrameRateMessage)) {
                            viewModel.showingLowFrameRateMessage = true;
                        }

                        viewModel.notifiedOfLowFrameRate = true;
                        viewModel._needsQuietPeriod = true;
                    }
                } else if (viewModel.showingLowFrameRateMessage) {
                    viewModel.showingLowFrameRateMessage = false;
                    viewModel._needsQuietPeriod = true;
                }
            }
        }
    }

    function visibilityChanged(viewModel) {
        if (document[viewModel._hiddenPropertyName]) {
            viewModel._frameTimes.length = 0;
        } else {
            viewModel._needsQuietPeriod = true;
        }
    }

    function shouldDoPerformanceTracking(viewModel) {
        return !viewModel.lowFrameRateMessageDismissed && !viewModel.showingMessage && !document[viewModel._hiddenPropertyName];
    }

    return PerformanceWatchdogViewModel;
});