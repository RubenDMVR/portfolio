

(function(root, factory) {
    if(typeof exports === 'object') {
        module.exports = factory(require('jquery'));
    }
    else if(typeof define === 'function' && define.amd) {
        define('EasyPieChart', ['jquery'], factory);
    }
    else {
        factory(root.jQuery);
    }
}(this, function($) {
/**
 * Renderer to render the chart on a canvas object
 * @param {DOMElement} el      DOM element to host the canvas (root of the plugin)
 * @param {object}     options options object of the plugin
 */
var CanvasRenderer = function(el, options) {
	var cachedBackground;
	var canvas = document.createElement('canvas');

	if (typeof(G_vmlCanvasManager) !== 'undefined') {
		G_vmlCanvasManager.initElement(canvas);
	}

	var ctx = canvas.getContext('2d');

	canvas.width = canvas.height = options.size;

	el.appendChild(canvas);

	// canvas on retina devices
	var scaleBy = 1;
	if (window.devicePixelRatio > 1) {
		scaleBy = window.devicePixelRatio;
		canvas.style.width = canvas.style.height = [options.size, 'px'].join('');
		canvas.width = canvas.height = options.size * scaleBy;
		ctx.scale(scaleBy, scaleBy);
	}

	// move 0,0 coordinates to the center
	ctx.translate(options.size / 2, options.size / 2);

	// rotate canvas -90deg
	ctx.rotate((-1 / 2 + options.rotate / 180) * Math.PI);

	var radius = (options.size - options.lineWidth) / 2;
	if (options.scaleColor && options.scaleLength) {
		radius -= options.scaleLength + 2; // 2 is the distance between scale and bar
	}

	// IE polyfill for Date
	Date.now = Date.now || function() {
		return +(new Date());
	};

	/**
	 * Draw a circle around the center of the canvas
	 * @param  {strong} color     Valid CSS color string
	 * @param  {number} lineWidth Width of the line in px
	 * @param  {number} percent   Percentage to draw (float between 0 and 1)
	 */
	var drawCircle = function(color, lineWidth, percent) {
		percent = Math.min(Math.max(0, percent || 1), 1);

		ctx.beginPath();
		ctx.arc(0, 0, radius, 0, Math.PI * 2 * percent, false);

		ctx.strokeStyle = color;
		ctx.lineWidth = lineWidth;

		ctx.stroke();
	};

	/**
	 * Draw the scale of the chart
	 */
	var drawScale = function() {
		var offset;
		var length;
		var i = 24;

		ctx.lineWidth = 1
		ctx.fillStyle = options.scaleColor;

		ctx.save();
		for (var i = 24; i > 0; --i) {
			if (i%6 === 0) {
				length = options.scaleLength;
				offset = 0;
			} else {
				length = options.scaleLength * .6;
				offset = options.scaleLength - length;
			}
			ctx.fillRect(-options.size/2 + offset, 0, length, 1);
			ctx.rotate(Math.PI / 12);
		}
		ctx.restore();
	};

	/**
	 * Request animation frame wrapper with polyfill
	 * @return {function} Request animation frame method or timeout fallback
	 */
	var reqAnimationFrame = (function() {
		return  window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				function(callback) {
					window.setTimeout(callback, 1000 / 60);
				};
	}());

	/**
	 * Draw the background of the plugin including the scale and the track
	 */
	var drawBackground = function() {
		options.scaleColor && drawScale();
		options.trackColor && drawCircle(options.trackColor, options.lineWidth);
	};

	/**
	 * Clear the complete canvas
	 */
	this.clear = function() {
		ctx.clearRect(options.size / -2, options.size / -2, options.size, options.size);
	};

	/**
	 * Draw the complete chart
	 * @param  {number} percent Percent shown by the chart between 0 and 100
	 */
	this.draw = function(percent) {
		// do we need to render a background
		if (!!options.scaleColor || !!options.trackColor) {
			// getImageData and putImageData are supported
			if (ctx.getImageData && ctx.putImageData) {
				if (!cachedBackground) {
					drawBackground();
					cachedBackground = ctx.getImageData(0, 0, options.size * scaleBy, options.size * scaleBy);
				} else {
					ctx.putImageData(cachedBackground, 0, 0);
				}
			} else {
				this.clear();
				drawBackground();
			}
		} else {
			this.clear();
		}

		ctx.lineCap = options.lineCap;

		// if barcolor is a function execute it and pass the percent as a value
		var color;
		if (typeof(options.barColor) === 'function') {
			color = options.barColor(percent);
		} else {
			color = options.barColor;
		}

		// draw bar
		if (percent > 0) {
			drawCircle(color, options.lineWidth, percent / 100);
		}
	}.bind(this);

	/**
	 * Animate from some percent to some other percentage
	 * @param  {number} from Starting percentage
	 * @param  {number} to   Final percentage
	 */
	this.animate = function(from, to) {
		var startTime = Date.now();
		options.onStart(from, to);
		var animation = function() {
			var process = Math.min(Date.now() - startTime, options.animate);
			var currentValue = options.easing(this, process, from, to - from, options.animate);
			this.draw(currentValue);
			options.onStep(from, to, currentValue);
			if (process >= options.animate) {
				options.onStop(from, to);
			} else {
				reqAnimationFrame(animation);
			}
		}.bind(this);

		reqAnimationFrame(animation);
	}.bind(this);
};

var EasyPieChart = function(el, opts) {
	var defaultOptions = {
		barColor: '#ff675f',
		trackColor: '#e1e1e3',
		scaleColor: '#e1e1e3',
		scaleLength: 0,
		lineCap: 'round',
		lineWidth: 15,
		size: 152,
		rotate: 0,
		animate: 1000,
		easing: function (x, t, b, c, d) { // more can be found here: http://gsgd.co.uk/sandbox/jquery/easing/
			t = t / (d/2);
			if (t < 1) {
				return c / 2 * t * t + b;
			}
			return -c/2 * ((--t)*(t-2) - 1) + b;
		},
		onStart: function(from, to) {
			return;
		},
		onStep: function(from, to, currentValue) {
			return;
		},
		onStop: function(from, to) {
			return;
		}
	};

	// detect present renderer
	if (typeof(CanvasRenderer) !== 'undefined') {
		defaultOptions.renderer = CanvasRenderer;
	} else if (typeof(SVGRenderer) !== 'undefined') {
		defaultOptions.renderer = SVGRenderer;
	} else {
		throw new Error('Please load either the SVG- or the CanvasRenderer');
	}

	var options = {};
	var currentValue = 0;

	/**
	 * Initialize the plugin by creating the options object and initialize rendering
	 */
	var init = function() {
		this.el = el;
		this.options = options;

		// merge user options into default options
		for (var i in defaultOptions) {
			if (defaultOptions.hasOwnProperty(i)) {
				options[i] = opts && typeof(opts[i]) !== 'undefined' ? opts[i] : defaultOptions[i];
				if (typeof(options[i]) === 'function') {
					options[i] = options[i].bind(this);
				}
			}
		}

		// check for jQuery easing
		if (typeof(options.easing) === 'string' && typeof(jQuery) !== 'undefined' && jQuery.isFunction(jQuery.easing[options.easing])) {
			options.easing = jQuery.easing[options.easing];
		} else {
			options.easing = defaultOptions.easing;
		}

		// create renderer
		this.renderer = new options.renderer(el, options);

		// initial draw
		this.renderer.draw(currentValue);

		// initial update
		if (el.dataset && el.dataset.percent) {
			this.update(parseFloat(el.dataset.percent));
		} else if (el.getAttribute && el.getAttribute('data-percent')) {
			this.update(parseFloat(el.getAttribute('data-percent')));
		}
	}.bind(this);

	/**
	 * Update the value of the chart
	 * @param  {number} newValue Number between 0 and 100
	 * @return {object}          Instance of the plugin for method chaining
	 */
	this.update = function(newValue) {
		newValue = parseFloat(newValue);
		if (options.animate) {
			this.renderer.animate(currentValue, newValue);
		} else {
			this.renderer.draw(newValue);
		}
		currentValue = newValue;
		return this;
	}.bind(this);

	init();
};

$.fn.easyPieChart = function(options) {
	return this.each(function() {
		if (!$.data(this, 'easyPieChart')) {
			$.data(this, 'easyPieChart', new EasyPieChart(this, options));
		}
	});
};

}));





//------------------------------index--html--------------------------------



  <div id="skills">
        <h2 class="heading">Compétences techniques</h2>
        <p>Les différents domaines que je maîtrise</p>

          <!--technical start-->
  <section class="technical" id="technical">
    <div class="container">
      
      <div class="row">
        <div class=" col-xs-12 col-sm-4 col-md-4 col-lg-4 skillsArea">
          <div class=" col-xs-12 col-sm-6 col-md-6 col-lg-6 skills"> <span class="chart skilBg" data-percent="90"> <span class="percent"></span> </span>
            <h4>HTML5 / CSS3</h4>
            <p>&nbsp;</p>
          </div>
        </div>
        <div class=" col-xs-12 col-sm-4 col-md-4 col-lg-4 skillsArea">
          <div class=" col-xs-12 col-sm-6 col-md-6 col-lg-6 skills"> <span class="chart skilBg" data-percent="80"> <span class="percent"></span> </span>
            <h4>jQuery</h4>
            <p>&nbsp;</p>
          </div>
        </div>
        <div class=" col-xs-12 col-sm-4 col-md-4 col-lg-4 skillsArea">
          <div class=" col-xs-12 col-sm-6 col-md-6 col-lg-6 skills"> <span class="chart skilBg" data-percent="80"> <span class="percent"></span> </span>
            <h4>PHP / MySQL</h4>
            <p>&nbsp;</p>
          </div>
        </div>
        <div class=" col-xs-12 col-sm-4 col-md-4 col-lg-4 skillsArea">
          <div class=" col-xs-12 col-sm-6 col-md-6 col-lg-6 skills"> <span class="chart skilBg" data-percent="75"> <span class="percent"></span> </span>
            <h4>Java</h4>
            <p>&nbsp;</p>
          </div>
        </div>
        <div class=" col-xs-12 col-sm-4 col-md-4 col-lg-4 skillsArea">
          <div class=" col-xs-12 col-sm-6 col-md-6 col-lg-6 skills"> <span class="chart skilBg" data-percent="70"> <span class="percent"></span> </span>
            <h4>Wordpress</h4>
            <p>&nbsp;</p>
          </div>
        </div>
        <div class=" col-xs-12 col-sm-4 col-md-4 col-lg-4 skillsArea">
          <div class=" col-xs-12 col-sm-6 col-md-6 col-lg-6 skills"> <span class="chart skilBg" data-percent="50"> <span class="percent"></span> </span>
            <h4>C/C++</h4>
            <p>&nbsp;</p>
          </div>
        </div>
      </div>
    </div>
  </section>
  <!--technical end-->

        
    </div>
    <!-- End #skills -->










    //------------------------------styles--css--------------------------------




    /*----------------------------------------------------
 7.	Technical Skills Style
------------------------------------------------------*/
.addspace{
	height:60px;
	background:#eeeeee;
}

.technical{
	background:#eeeeee;
	color:#374054;
}
.technical.container
{
	padding-top:85px ;
	padding-bottom:69px ;
}
.technical .heading p{
	padding-bottom:41px;
}

.technical p{
	color:#474d5d;
}
.technical h2{
	color:#ff675f;
}

.technical .skillsArea{
	padding:0px;
}
.technical .skills{
	margin:0 auto;
	margin-bottom:23px;
	text-align:center;
	padding:0px;
	float:none;
}
.technical .skills p{
	color:#84868d;
	font-size:13px;
	line-height:18px;
	text-align:center;
}
.technical .skills img{
	margin:0 auto;
	margin-bottom:33px;
	width:100%;
	max-width:152px;
}

.technical .skills h4{
	font-weight:700;
	text-transform:uppercase;
}


.skilBg{
	background:url(../images/skills.png) no-repeat 0 0;
}


.chart {
  position: relative;
  display: inline-block;
  width: 152px;
  height: 152px;
  margin-bottom: 26px;
  text-align: center;
}
.chart canvas {
  position: absolute;
  top: 0;
  left: 0;
}
.percent {
  display: inline-block;
  font-size:21px;
  color:#474d5d;
  line-height: 152px;
  z-index: 2;
}
.percent:after {
  content: '%';
  margin-left: 0.1em;
  font-size: .8em;
}
.angular {
  margin-top: 100px;
}
.angular .chart {
  margin-top: 0;
}






    //------------------------------scripts--js--------------------------------




 // for skill chat jquary
$(document).ready(function(e) {
//var windowBottom = $(window).height();
var index=0;
$(document).scroll(function(){
    var top = $('.technical').height()-$(window).scrollTop();
    //console.log(top)
    if(top<-300){
        if(index==0){   
            
            $('.chart').easyPieChart({
                easing: 'easeOutBounce',
                onStep: function(from, to, percent) {
                    $(this.el).find('.percent').text(Math.round(percent));
                }
            });
            
        }
        index++;
    }
})





