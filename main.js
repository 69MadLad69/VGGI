'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let params = {
    a: 0.8,
    c: 2.0,
    theta: 0.2 * Math.PI,
    tMin: -2.0,
    tMax: 2.0,
    uSteps: 50,
    tSteps: 50
};

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        this.count = vertices.length/3;
    }

    this.Draw = function() {

         gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        const uSteps = params.uSteps;
        const tSteps = params.tSteps;

        const uLineVertexCount = uSteps + 1;
        const vLineVertexCount = tSteps + 1;

        let offset = 0;

        for (let i = 0; i <= tSteps; i++) {
            gl.drawArrays(gl.LINE_STRIP, offset, uLineVertexCount);
            offset += uLineVertexCount;
        }

        for (let j = 0; j < uSteps; j++) {
            gl.drawArrays(gl.LINE_STRIP, offset, vLineVertexCount);
            offset += vLineVertexCount;
        }
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    resizeCanvasToDisplaySize(gl.canvas);
    gl.clearColor(0.05, 0.05, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Adjust zoom by modifying camera distance (not clipping)
    let cameraDistance = zoom;
    let fov = Math.PI / 8;
    let projection = m4.perspective(fov, gl.canvas.width / gl.canvas.height, 0.1, 100);
    
    // View matrix from the TrackballRotator
    let modelView = spaceball.getViewMatrix();

    // Move the whole scene back based on zoom
    let translateToPointZero = m4.translation(0, 0, -cameraDistance);

    // Combine transforms
    let matAccum0 = m4.multiply(translateToPointZero, modelView);
    let modelViewProjection = m4.multiply(projection, matAccum0);

    // Send to shader
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.uniform4fv(shProgram.iColor, [0.2, 0.8, 1.0, 1.0]);

    surface.Draw();
}


function surfacePoint(u, t, p) {
    const { a, c, theta } = p;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);

    const radius = a + t * cosTheta + c * t * t * sinTheta;

    return {
        x: radius * cosU,
        y: radius * sinU,
        z: t * sinTheta + c * t * t * cosTheta
    };
}

function CreateSurfaceData()
{
    let vertexList = [];

    const { tMin, tMax, uSteps, tSteps } = params;

    // U lines (circles around axis)
    for (let i = 0; i <= tSteps; i++) {
        const t = tMin + (tMax - tMin) * i / tSteps;
        for (let j = 0; j <= uSteps; j++) {
            const u = 2 * Math.PI * j / uSteps;
            const p = surfacePoint(u, t, params);
            vertexList.push(p.x, p.y, p.z);
        }
    }

    // V lines (meridians)
    for (let j = 0; j < uSteps; j++) {
        const u = 2 * Math.PI * j / uSteps;
        for (let i = 0; i <= tSteps; i++) {
            const t = tMin + (tMax - tMin) * i / tSteps;
            const p = surfacePoint(u, t, params);
            vertexList.push(p.x, p.y, p.z);
        }
    }

    return vertexList;
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData());

    gl.enable(gl.DEPTH_TEST);
}

function updateSurface() {
    surface.BufferData(CreateSurfaceData());
    draw();
}

function setupControls() {
    const sliders = [
        { id: 'aSlider', key: 'a', scale: 1 },
        { id: 'cSlider', key: 'c', scale: 1 },
        { id: 'thetaSlider', key: 'theta', scale: 1 },
        { id: 'tRangeSlider', key: 'tRange', scale: 1 },
        { id: 'resSlider', key: 'res', scale: 1 }
    ];

    sliders.forEach(sl => {
        const el = document.getElementById(sl.id);
        if (!el) return;
        el.addEventListener('input', e => {
            const value = parseFloat(e.target.value);
            if (sl.key === 'tRange') {
                params.tMin = -value;
                params.tMax = value;
            } else if (sl.key === 'res') {
                params.uSteps = Math.round(value);
                params.tSteps = Math.round(value);
            } else {
                params[sl.key] = value;
            }
            updateSurface();
        });
    });
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);
    setupControls();
    draw();
}