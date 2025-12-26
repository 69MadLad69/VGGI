let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let diffuseTexture, specularTexture, normalTexture;

let params = {
    a: 0.8,
    c: 2.0,
    theta: 0.2 * Math.PI,
    tMin: -2.0,
    tMax: 2.0,
    uSteps: 50,
    tSteps: 50
};

let texPivot = { u: 0.5, v: 0.5 };
let texScale = 1.0;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function Model(name) {
    this.name = name;

    this.vertexBuffer = gl.createBuffer();
    this.normalBuffer = gl.createBuffer();
    this.tangentBuffer = gl.createBuffer();
    this.texCoordBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();
    this.indexCount = 0;

    this.BufferData = function (geometry) {
        // positions
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.positions), gl.STATIC_DRAW);

        // normals
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normals), gl.STATIC_DRAW);

        // tangents
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.tangents), gl.STATIC_DRAW);

        // texcoords
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.texcoords), gl.STATIC_DRAW);

        // indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);

        this.indexCount = geometry.indices.length;
    };

    this.Draw = function () {
        // positions
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        // normals
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        // tangents
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        // texcoords
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoord);

        // indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    };
}

function analyticNormal(u, t, p) {
    const { a, c, theta } = p;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);

    const A = a + t * cosT + c * t * t * sinT;
    const Aprime = cosT + 2 * c * t * sinT;
    const zprime = sinT + 2 * c * t * cosT;

    let nx = -A * zprime * cosU;
    let ny = -A * zprime * sinU;
    let nz = A * Aprime;

    const len = Math.hypot(nx, ny, nz) || 1.0;
    return { x: nx / len, y: ny / len, z: nz / len };
}

function analyticTangentU(u, t, p) {
    const { a, c, theta } = p;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);

    const R = a + t * cosT + c * t * t * sinT;

    let tx = -R * sinU;
    let ty = R * cosU;
    let tz = 0.0;

    const len = Math.hypot(tx, ty, tz) || 1.0;
    return { x: tx / len, y: ty / len, z: tz / len };
}

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTangent = -1;
    this.iAttribTexCoord = -1;

    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix = -1;
    this.iNormalMatrix = -1;

    this.iLightPosition = -1;
    this.iAmbient = -1;
    this.iDiffuse = -1;
    this.iSpecular = -1;
    this.iShininess = -1;

    this.iDiffuseMap = -1;
    this.iSpecularMap = -1;
    this.iNormalMap = -1;

    this.iTexPivot = -1;
    this.iTexScale = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    };
}


let lightAngle = 0.0;

function draw(time) {
    resizeCanvasToDisplaySize(gl.canvas);
    gl.clearColor(0.05, 0.05, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (time === undefined) time = performance.now();
    lightAngle = time * 0.0003;
    let cameraDistance = zoom;
    let fov = Math.PI / 8;
    let projection = m4.perspective(fov, gl.canvas.width / gl.canvas.height, 0.1, 300.0);

    let viewRot = spaceball.getViewMatrix();
    let translateToPointZero = m4.translation(0, 0, -cameraDistance);
    let modelView = m4.multiply(translateToPointZero, viewRot);

    let modelViewProjection = m4.multiply(projection, modelView);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelView);

    let normalMatrix = m4.inverse(modelView);
    normalMatrix = m4.transpose(normalMatrix);
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    const lightRadius = 15.0;
    const lightHeight = 5.0;
    const lx = lightRadius * Math.cos(lightAngle);
    const ly = lightRadius * Math.sin(lightAngle);
    const lz = lightHeight;
    const lightWorld = [lx, ly, lz, 1.0];
    const lightEye = m4.transformPoint(modelView, lightWorld);

    gl.uniform3fv(shProgram.iLightPosition, [lightEye[0], lightEye[1], lightEye[2]]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, diffuseTexture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, specularTexture);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, normalTexture);

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

function CreateSurfaceData() {
    const positions = [];
    const normals = [];
    const tangents = [];
    const texcoords = [];
    const indices = [];

    const { tMin, tMax, uSteps, tSteps } = params;

    for (let i = 0; i <= tSteps; i++) {
        const v = i / tSteps;
        const t = tMin + (tMax - tMin) * v;

        for (let j = 0; j <= uSteps; j++) {
            const u = 2 * Math.PI * j / uSteps;

            const p = surfacePoint(u, t, params);
            const n = analyticNormal(u, t, params);
            const tan = analyticTangentU(u, t, params);

            positions.push(p.x, p.y, p.z);
            normals.push(n.x, n.y, n.z);
            tangents.push(tan.x, tan.y, tan.z);

            const s = u / (2.0 * Math.PI);
            const w = (t - tMin) / (tMax - tMin);
            texcoords.push(s, w);
        }
    }

    const rowVerts = uSteps + 1;
    for (let i = 0; i < tSteps; i++) {
        for (let j = 0; j < uSteps; j++) {
            const i0 = i * rowVerts + j;
            const i1 = i * rowVerts + (j + 1);
            const i2 = (i + 1) * rowVerts + j;
            const i3 = (i + 1) * rowVerts + (j + 1);

            indices.push(i0, i2, i1);
            indices.push(i1, i2, i3);
        }
    }

    return { positions, normals, tangents, texcoords, indices };
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    // attributes
    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTangent = gl.getAttribLocation(prog, "tangent");
    shProgram.iAttribTexCoord = gl.getAttribLocation(prog, "texCoord");

    // matrices
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, "NormalMatrix");

    // lighting
    shProgram.iLightPosition = gl.getUniformLocation(prog, "uLightPosition");
    shProgram.iAmbient = gl.getUniformLocation(prog, "uAmbient");
    shProgram.iDiffuse = gl.getUniformLocation(prog, "uDiffuse");
    shProgram.iSpecular = gl.getUniformLocation(prog, "uSpecular");
    shProgram.iShininess = gl.getUniformLocation(prog, "uShininess");

    shProgram.iDiffuseMap = gl.getUniformLocation(prog, "uDiffuseMap");
    shProgram.iSpecularMap = gl.getUniformLocation(prog, "uSpecularMap");
    shProgram.iNormalMap = gl.getUniformLocation(prog, "uNormalMap");

    // texture scaling uniforms
    shProgram.iTexPivot = gl.getUniformLocation(prog, "uTexPivot");
    shProgram.iTexScale = gl.getUniformLocation(prog, "uTexScale");

    gl.uniform3fv(shProgram.iAmbient,  [0.1, 0.1, 0.1]);
    gl.uniform3fv(shProgram.iDiffuse,  [0.8, 0.8, 0.8]);
    gl.uniform3fv(shProgram.iSpecular, [1.0, 1.0, 1.0]);
    gl.uniform1f (shProgram.iShininess, 32.0);

    gl.uniform1i(shProgram.iDiffuseMap,  0);
    gl.uniform1i(shProgram.iSpecularMap, 1);
    gl.uniform1i(shProgram.iNormalMap,   2);

    // initial UV transform
    gl.uniform2f(shProgram.iTexPivot, texPivot.u, texPivot.v);
    gl.uniform1f(shProgram.iTexScale, texScale);

    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData());

    diffuseTexture  = createTexture("textures/diffuse.png");
    specularTexture = createTexture("textures/specular.png");
    normalTexture   = createTexture("textures/normal.png");

    gl.enable(gl.DEPTH_TEST);
}

function createTexture(url) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);

    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([255, 255, 255, 255]);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  width, height, border, srcFormat, srcType, pixel);

    const image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    };
    image.src = url;

    return tex;
}


function updateSurface() {
    surface.BufferData(CreateSurfaceData());
    draw();
}

function setupControls() {
    const sliders = [
        { id: 'aSlider', key: 'a'},
        { id: 'cSlider', key: 'c'},
        { id: 'thetaSlider', key: 'theta'},
        { id: 'tRangeSlider', key: 'tRange'},
        { id: 'uResSlider', key: 'uSteps'},
        { id: 'vResSlider', key: 'tSteps'}
    ];

    sliders.forEach(sl => {
        const el = document.getElementById(sl.id);
        if (!el) return;

        el.addEventListener('input', e => {
            const value = parseFloat(e.target.value);

            if (sl.key === 'tRange') {
                params.tMin = -value;
                params.tMax = value;
            } else if (sl.key === 'uSteps') {
                params.uSteps = Math.round(value);
            } else if (sl.key === 'tSteps') {
                params.tSteps = Math.round(value);
            } else {
                params[sl.key] = value;
            }

            updateSurface();
        });
    });
}

function handleKeyDown(e) {
    if (!gl || !shProgram) return;

    const step = 0.02;
    const scaleUp  = 1.1;
    const scaleDown = 1.0 / scaleUp;

    switch (e.key.toLowerCase()) {
        case 'a':
            texPivot.u -= step;
            break;
        case 'd':
            texPivot.u += step;
            break;
        case 'w':
            texPivot.v += step;
            break;
        case 's':
            texPivot.v -= step;
            break;

        case 'q':
            texScale *= scaleUp;
            break;
        case 'e':
            texScale *= scaleDown;
            break;
        default:
            return;
    }

    texPivot.u = Math.max(0.0, Math.min(1.0, texPivot.u));
    texPivot.v = Math.max(0.0, Math.min(1.0, texPivot.v));

    texScale = Math.max(0.1, Math.min(10.0, texScale));

    gl.uniform2f(shProgram.iTexPivot, texPivot.u, texPivot.v);
    gl.uniform1f(shProgram.iTexScale, texScale);
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
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, () => {}, 0);

    setupControls();

    window.addEventListener('keydown', handleKeyDown);

    function animate(time) {
        draw(time);
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}