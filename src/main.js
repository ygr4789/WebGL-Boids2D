"use strict";

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  let canvas = document.querySelector("#canvas");
  let gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }
  webglUtils.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  const shaderProgram = webglUtils.createProgramFromScripts(gl, ["vertex-shader-2d", "fragment-shader-2d"]);
  const positionAttributeLocation = gl.getAttribLocation(shaderProgram, "a_position");
  const resolutionUniformLocation = gl.getUniformLocation(shaderProgram, "u_resolution");
  const colorUniformLocation = gl.getUniformLocation(shaderProgram, "u_color");
  const translationLocation = gl.getUniformLocation(shaderProgram, "u_translation");
  const rotationLocation = gl.getUniformLocation(shaderProgram, "u_rotation");
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  gl.useProgram(shaderProgram);
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const size = 2;
  const type = gl.FLOAT;
  const normalize = false;
  const stride = 0;
  const offset = 0;
  gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
  gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

  let boids = [];
  const numboids = 1000;
  const avoidDistance = 20;
  const sightDistance = 75;
  const margin = 200;
  const bounding = 1000;
  const factor = [
    5.0, // centering
    10.0, // keep distance
    5.0, // match
  ];
  const vlim = 500;
  let Xmin, Xmax, Ymin, Ymax;

  function Boid() {
    this.x = Math.random() * (gl.canvas.width - 2 * margin) + margin;
    this.y = Math.random() * (gl.canvas.height - 2 * margin) + margin;
    this.vy = (Math.random() - 0.5) * 600;
    this.vx = (Math.random() - 0.5) * 600;
    this.ax = 0;
    this.ay = 0;
    this.color = [1, 0, 0, 1];
    this.update = function (dt) {
      this.vx += this.ax * dt;
      this.vy += this.ay * dt;
      limitingVelocity(this);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    };
  }

  function initBoids() {
    for (let i = 0; i < numboids; i++) {
      boids.push(new Boid());
    }
  }
  function initBounds() {
    Xmin = Ymin = margin;
    Xmax = gl.canvas.width - margin;
    Ymax = gl.canvas.height - margin;
  }

  const boidRules = [
    function (boid) {
      // rule1
      let ret = [0, 0];
      let perceivedCentreX = 0;
      let perceivedCentreY = 0;
      let countNN = 0;
      for (let boid_ of boids) {
        if (boid === boid_) continue;
        if (distOfBoids(boid, boid_) > sightDistance) continue;
        countNN++;
        perceivedCentreX += boid_.x;
        perceivedCentreY += boid_.y;
      }
      if (countNN != 0) {
        perceivedCentreX /= countNN;
        perceivedCentreY /= countNN;
        ret[0] = perceivedCentreX - boid.x;
        ret[1] = perceivedCentreY - boid.y;
      }
      return ret;
    },
    function (boid) {
      // rule2
      let ret = [0, 0];
      for (let boid_ of boids) {
        if (boid === boid_) continue;
        let dist = distOfBoids(boid, boid_);
        if (dist > avoidDistance) continue;
        ret[0] -= boid_.x - boid.x;
        ret[1] -= boid_.y - boid.y;
      }
      return ret;
    },
    function (boid) {
      // rule3
      let ret = [0, 0];
      let perceivedVelocityX = 0;
      let perceivedVelocityY = 0;
      let countNN = 0;
      for (let boid_ of boids) {
        if (boid === boid_) continue;
        if (distOfBoids(boid, boid_) > sightDistance) continue;
        countNN++;
        perceivedVelocityX += boid_.vx;
        perceivedVelocityY += boid_.vy;
      }
      if (countNN != 0) {
        perceivedVelocityX /= countNN;
        perceivedVelocityY /= countNN;
        ret[0] = perceivedVelocityX - boid.vx;
        ret[1] = perceivedVelocityY - boid.vy;
      }
      return ret;
    },
  ];

  function distOfBoids(b1, b2) {
    return Math.sqrt(Math.pow(b1.x - b2.x, 2) + Math.pow(b1.y - b2.y, 2));
  }
  function normOfVector(x, y) {
    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
  }

  function applyAllRules(boid) {
    let acc = [0, 0];
    boidRules.forEach((rule, index) => {
      let acc_ = rule(boid);
      acc[0] += acc_[0] * factor[index];
      acc[1] += acc_[1] * factor[index];
    });
    boid.ax = acc[0];
    boid.ay = acc[1];
  }

  function boundingPosition(boid) {
    if (boid.x < Xmin) boid.ax = bounding;
    if (boid.x > Xmax) boid.ax = -bounding;
    if (boid.y < Ymin) boid.ay = bounding;
    if (boid.y > Ymax) boid.ay = -bounding;
  }

  function limitingVelocity(boid) {
    let vnorm = normOfVector(boid.vx, boid.vy);
    if (vnorm > vlim) {
      boid.vx = boid.vx * (vlim / vnorm);
      boid.vy = boid.vy * (vlim / vnorm);
    }
  }

  function updateBoidsVelocity(dt) {
    for (let boid of boids) {
      applyAllRules(boid);
      boundingPosition(boid);
      limitingVelocity(boid);
      boid.update(dt);
    }
  }

  initBounds();
  initBoids();

  let then = 0;
  function drawScene(now) {
    now *= 0.001;
    let timeDiff = now - then;
    then = now;

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (let boid of boids) {
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-5, -5, 0, 10, 5, -5]), gl.STATIC_DRAW);

      gl.uniform4fv(colorUniformLocation, boid.color);

      let translation = [0, 0];
      translation[0] = boid.x;
      translation[1] = boid.y;
      gl.uniform2fv(translationLocation, translation);

      let rotation = [0, 1];
      if (boid.x !== 0 || boid.y !== 0) {
        let vnorm = normOfVector(boid.vx, boid.vy);
        rotation[0] = boid.vx / vnorm;
        rotation[1] = boid.vy / vnorm;
      }
      gl.uniform2fv(rotationLocation, rotation);

      // Draw the rectangle.
      let primitiveType = gl.TRIANGLES;
      let offset = 0;
      let count = 3;
      gl.drawArrays(primitiveType, offset, count);
    }

    updateBoidsVelocity(timeDiff);
    requestAnimationFrame(drawScene);
  }
  requestAnimationFrame(drawScene);
}

main();
