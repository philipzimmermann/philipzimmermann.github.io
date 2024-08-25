function get1ToN(n) {
    return new Array(n).fill(0).map((d, i) => i);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function computeVelocities(n) {
    var output = [];
    var velocity = 0;

    for (var i = 0; i < n; i++) {
        output.push(velocity);
        if (i < n / 3) {
            velocity++;
        } else if (i < 2 * n / 3) {
            // constant velocity
        } else {
            velocity--;
        }
    }
    return output;
}

function computeDistances(velocities) {
    var output = [];
    var distance = 0;
    for (var i = 0; i < velocities.length; i++) {
        output.push(distance);
        distance += velocities[i];
    }
    return output;
}

function animateLinePlot(x, y, div, xlabel, ylabel) {
    Plotly.newPlot(div, [{
        x: x[0],
        y: y[0],
        mode: 'lines',
        // name: name,
        // showlegend: true,
    }], {
        margin: { t: 0, r: 160 },
        xaxis: { title: xlabel, range: [0, x.length * 1.1] },
        yaxis: { title: ylabel, range: [0, Math.max.apply(Math, y) * 1.3] },

    },);

    for (i = 0; i <= x.length; i++) {
        Plotly.animate(div, {
            data: [{ x: x.slice(0, i), y: y.slice(0, i) }],
            traces: [0],
            layout: {}
        }, {
            transition: {
                duration: 0,
                // easing: 'cubic-in'
            },
            frame: {
                duration: 20,
            }
        })
    }
}

function initialize() {
    const numberTimePoints = 101;
    const times = get1ToN(numberTimePoints);
    const velocities = computeVelocities(numberTimePoints);
    var velocityDiv = document.getElementById("velocityPlot");
    animateLinePlot(times, velocities, velocityDiv, "Time", "Velocity");
    const distances = computeDistances(velocities);
    var distanceDiv = document.getElementById("distancePlot");
    animateLinePlot(times, distances, distanceDiv, "Time", "Driven Distance");
}

initialize();