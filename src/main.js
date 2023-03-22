"use strict";

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  let objects = [];
  let numObjects = 100;
  let avoidDistance = 20;
  // let visualRange = 20;
  let margin = 100;
  let factor1 = 0.005;
  let factor3 = 0.05;
  let factor2 = 0.05;
  let vlim = 500;
  let Xmin, Xmax, Ymin, Ymax;

  function object() {
    this.x = Math.random() * gl.canvas.width;
    this.y = Math.random() * gl.canvas.height;
    this.vy = (Math.random() - 0.5) * 100000;
    this.vx = (Math.random() - 0.5) * 100000;
    this.color = [Math.random(), Math.random(), Math.random(), 1];
    this.update = function (dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    };
  }

  function initBoids() {
    for (let i = 0; i < numObjects; i++) {
      objects.push(new object());
    }
  }

  function distOfBoids(b1, b2) {
    return Math.sqrt(Math.pow(b1.x - b2.x, 2) + Math.pow(b1.y - b2.y, 2));
  }
  function normOfVector(x, y) {
    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
  }
  function updateBound() {
    Xmin = Ymin = margin;
    Xmax = gl.canvas.width - margin;
    Ymax = gl.canvas.height - margin;
  }

  function updateBoidsVelocity() {
    for (let i = 0; i < numObjects; i++) {
      var ax1, ax2, ax3;
      var ay1, ay2, ay3;

      let meanPosX = 0;
      let meanPosY = 0;
      let meanVelX = 0;
      let meanVelY = 0;
      for (let j = 0; j < numObjects; j++) {
        meanPosX += objects[j].x / numObjects;
        meanPosY += objects[j].y / numObjects;
        meanVelX += objects[j].vx / numObjects;
        meanVelY += objects[j].vy / numObjects;
      }

      ax1 = (meanPosX - objects[i].x) * factor1;
      ay1 = (meanPosY - objects[i].y) * factor1;
      ax3 = (meanVelX - objects[i].vx) * factor3;
      ay3 = (meanVelY - objects[i].vy) * factor3;
      ax2 = ay2 = 0;
      for (let j = 0; j < numObjects; j++) {
        if (i == j) continue;
        if (distOfBoids(objects[i], objects[j]) > avoidDistance) continue;
        var dx = objects[j].x - objects[i].x;
        var dy = objects[j].y - objects[i].y;
        ax2 -= dx * factor2;
        ay2 -= dy * factor2;
      }

      objects[i].vx += ax1 + ax2 + ax3;
      objects[i].vy += ay1 + ay2 + ay3;

      var vnorm = normOfVector(objects[i].vx, objects[i].vy);
      if (vnorm > vlim) {
        objects[i].vx = (objects[i].vx / vnorm) * vlim;
        objects[i].vy = (objects[i].vy / vnorm) * vlim;
      }

      if (objects[i].x < Xmin) objects[i].vx += 1;
      else if (objects[i].x > Xmax) objects[i].vx -= 1;
      else if (objects[i].y < Ymin) objects[i].vy += 1;
      else if (objects[i].y > Ymax) objects[i].vy -= 1;
    }
  }

  function updateBoidsPosition(dt) {
    for (let i = 0; i < numObjects; i++) {
      objects[i].update(dt);
    }
  }

  updateBound();
  initBoids();
  // setup GLSL program
  var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader-2d", "fragment-shader-2d"]);
  // look up where the datas need to go.
  var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  var resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
  var colorUniformLocation = gl.getUniformLocation(program, "u_color");
  var translationLocation = gl.getUniformLocation(program, "u_translation");
  // Create a buffer to put three 2d clip space points in
  var positionBuffer = gl.createBuffer();
  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  webglUtils.resizeCanvasToDisplaySize(gl.canvas);
  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  // Tell it to use our program (pair of shaders)
  gl.useProgram(program);
  // Turn on the attribute
  gl.enableVertexAttribArray(positionAttributeLocation);
  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  var size = 2; // 2 components per iteration
  var type = gl.FLOAT; // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0; // start at the beginning of the buffer
  gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
  // set the resolution
  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

  let prev = 0;
  // drawScene();
  requestAnimationFrame(drawScene);
  function drawScene(curr) {
    curr *= 0.001;
    let timeDiff = curr - prev;
    prev = curr;

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (let i = 0; i < numObjects; i++) {
      setRectangle(gl);

      gl.uniform4fv(colorUniformLocation, objects[i].color);

      var translation = [0, 0];
      translation[0] = objects[i].x;
      translation[1] = objects[i].y;
      gl.uniform2fv(translationLocation, translation);

      // Draw the rectangle.
      var primitiveType = gl.TRIANGLES;
      var offset = 0;
      var count = 6;
      gl.drawArrays(primitiveType, offset, count);
    }

    updateBound();
    updateBoidsVelocity();
    updateBoidsPosition(timeDiff);
    requestAnimationFrame(drawScene);
  }
}

// Returns a random integer from 0 to range - 1.
function randomInt(range) {
  return Math.floor(Math.random() * range);
}

// Fill the buffer with the values that define a rectangle.
function setRectangle(gl) {
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 10, 0, 0, 10, 0, 10, 10, 0, 10, 10]), gl.STATIC_DRAW);
}

main();
