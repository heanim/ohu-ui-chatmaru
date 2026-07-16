(() => {
  "use strict";

  const canvas = document.getElementById("ripple-canvas");
  const loading = document.getElementById("loading");

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    powerPreference: "high-performance",
  });

  if (!gl) {
    showFallback("이 브라우저에서는 물결 효과를 사용할 수 없습니다.");
    return;
  }

  const DESKTOP_IMAGE = "background-desktop.jpg";
  const MOBILE_IMAGE = "background-mobile.jpg";
const SOUND_FILES = [
  "water-drop-1.wav",
  "water-drop-2.wav",
  "water-drop-3.wav",
];

const SOUND_VOLUME = 0.10;
  /*
    파동 설정값
    지금은 수정하지 말고 먼저 그대로 확인하기
  */
  const MAX_RIPPLES = 10;
  const RIPPLE_DURATION = 4.6;
  const RIPPLE_SIZE = 0.82;
  const RIPPLE_STRENGTH = 0.010;

  const vertexShaderSource = `
    attribute vec2 aPosition;

    varying vec2 vUv;

    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision highp float;

    #define MAX_RIPPLES 10

    varying vec2 vUv;

    uniform sampler2D uImage;

    uniform vec2 uResolution;
    uniform vec2 uImageResolution;

    uniform float uTime;

    uniform vec2 uRippleCenter[MAX_RIPPLES];
    uniform float uRippleStart[MAX_RIPPLES];
    uniform float uRippleStrength[MAX_RIPPLES];

    vec2 coverUv(vec2 uv) {
      float screenAspect = uResolution.x / uResolution.y;
      float imageAspect = uImageResolution.x / uImageResolution.y;

      if (screenAspect > imageAspect) {
        float visibleHeight = imageAspect / screenAspect;

        uv.y =
          (uv.y - 0.5) * visibleHeight + 0.5;
      } else {
        float visibleWidth = screenAspect / imageAspect;

        uv.x =
          (uv.x - 0.5) * visibleWidth + 0.5;
      }

      return uv;
    }

    float easeOut(float value) {
      return 1.0 - pow(1.0 - value, 2.0);
    }

    void main() {
      float aspect = uResolution.x / uResolution.y;

      vec2 totalOffset = vec2(0.0);
      float totalLight = 0.0;

      for (int i = 0; i < MAX_RIPPLES; i++) {
        float age = uTime - uRippleStart[i];

        if (age >= 0.0 && age < ${RIPPLE_DURATION.toFixed(1)}) {
          float progress =
            age / ${RIPPLE_DURATION.toFixed(1)};

          float expandedProgress = easeOut(progress);

          float radius =
            expandedProgress * ${RIPPLE_SIZE.toFixed(2)};

          float fade =
            pow(1.0 - progress, 1.55);

          vec2 delta =
            vUv - uRippleCenter[i];

          vec2 correctedDelta =
            vec2(delta.x * aspect, delta.y);

          float distanceFromCenter =
            length(correctedDelta);

          /*
            파동이 존재하는 좁고 부드러운 영역.
            물리 시뮬레이션이 아니기 때문에
            화면 전체에 잔상이 남지 않는다.
          */
          float ringDistance =
            distanceFromCenter - radius;

          float envelope =
            exp(
              -pow(
                ringDistance / 0.052,
                2.0
              )
            );

          /*
            한 줄짜리 원이 아니라
            중심 파장 주변에 부드러운 잔파장이 생긴다.
          */
          float wave =
            sin(ringDistance * 105.0);

          vec2 direction =
            correctedDelta /
            max(distanceFromCenter, 0.0001);

          direction.x /= aspect;

          float distortion =
            wave *
            envelope *
            fade *
            uRippleStrength[i];

          totalOffset +=
            direction * distortion;

          /*
            실제 물결처럼 가장자리에만
            아주 약한 밝기 변화 추가
          */
          totalLight +=
            abs(wave) *
            envelope *
            fade *
            0.026;
        }
      }

      vec2 displacedUv =
        vUv + totalOffset;

      vec2 imageUv =
        coverUv(displacedUv);

      imageUv =
        clamp(imageUv, 0.001, 0.999);

      vec3 color =
        texture2D(uImage, imageUv).rgb;

vec3 highlightColor =
    vec3(1.00, 0.98, 0.88);

color +=
    highlightColor * totalLight;
      gl_FragColor =
        vec4(color, 1.0);
    }
  `;

  const program = createProgram(
    vertexShaderSource,
    fragmentShaderSource
  );

  if (!program) {
    showFallback("물결 그래픽을 불러오지 못했습니다.");
    return;
  }

  gl.useProgram(program);

  const positionLocation =
    gl.getAttribLocation(program, "aPosition");

  const imageLocation =
    gl.getUniformLocation(program, "uImage");

  const resolutionLocation =
    gl.getUniformLocation(program, "uResolution");

  const imageResolutionLocation =
    gl.getUniformLocation(
      program,
      "uImageResolution"
    );

  const timeLocation =
    gl.getUniformLocation(program, "uTime");

  const rippleCenterLocation =
    gl.getUniformLocation(
      program,
      "uRippleCenter[0]"
    );

  const rippleStartLocation =
    gl.getUniformLocation(
      program,
      "uRippleStart[0]"
    );

  const rippleStrengthLocation =
    gl.getUniformLocation(
      program,
      "uRippleStrength[0]"
    );

  const quadBuffer = gl.createBuffer();

  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    quadBuffer
  );

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,

      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  );

  gl.enableVertexAttribArray(
    positionLocation
  );

  gl.vertexAttribPointer(
    positionLocation,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );

  const rippleCenters =
    new Float32Array(MAX_RIPPLES * 2);

  const rippleStarts =
    new Float32Array(MAX_RIPPLES);

  const rippleStrengths =
    new Float32Array(MAX_RIPPLES);

  rippleStarts.fill(-100);

  let rippleIndex = 0;
  let imageTexture = null;
  let loadedImage = null;
  let activeImageSource = "";

  const startTime = performance.now();

  let pointerDown = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastRippleTime = 0;
function playRippleSound() {
  const source =
    SOUND_FILES[
      Math.floor(Math.random() * SOUND_FILES.length)
    ];

  const sound = new Audio(source);
  sound.volume = SOUND_VOLUME;

  sound.play().catch(() => {
    // 소리 재생이 막혀도 물결은 정상 작동
  });
}  function chooseImageSource() {
    return window.innerHeight > window.innerWidth
      ? MOBILE_IMAGE
      : DESKTOP_IMAGE;
  }

  function loadImage() {
    const source = chooseImageSource();

    if (
      source === activeImageSource &&
      imageTexture
    ) {
      return;
    }

    activeImageSource = source;

    loading.classList.remove("is-hidden");

    const image = new Image();

    image.onload = () => {
      loadedImage = image;

      if (imageTexture) {
        gl.deleteTexture(imageTexture);
      }

      imageTexture =
        createImageTexture(image);

      gl.uniform2f(
        imageResolutionLocation,
        image.naturalWidth,
        image.naturalHeight
      );

      loading.classList.add("is-hidden");
    };

    image.onerror = () => {
      showFallback(
        `${source} 파일을 불러오지 못했습니다.`
      );
    };

    image.src = source;
  }

  function resizeCanvas() {
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      1.7
    );

    const width = Math.max(
      1,
      Math.round(
        window.innerWidth * pixelRatio
      )
    );

    const height = Math.max(
      1,
      Math.round(
        window.innerHeight * pixelRatio
      )
    );

    if (
      canvas.width === width &&
      canvas.height === height
    ) {
      return;
    }

    canvas.width = width;
    canvas.height = height;

    gl.viewport(
      0,
      0,
      width,
      height
    );

    gl.uniform2f(
      resolutionLocation,
      width,
      height
    );
  }

  function createRipple(
    clientX,
    clientY,
    strength = RIPPLE_STRENGTH
  ) {
    const rect =
      canvas.getBoundingClientRect();

    const x =
      (clientX - rect.left) /
      rect.width;

    const y =
      1 -
      (clientY - rect.top) /
      rect.height;

    rippleCenters[rippleIndex * 2] = x;

    rippleCenters[
      rippleIndex * 2 + 1
    ] = y;

    rippleStarts[rippleIndex] =
      (performance.now() - startTime) /
      1000;

    rippleStrengths[rippleIndex] =
      strength;

    rippleIndex =
      (rippleIndex + 1) %
      MAX_RIPPLES;
  }

  function handlePointerDown(event) {
    pointerDown = true;

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    lastRippleTime = performance.now();

    canvas.setPointerCapture?.(
      event.pointerId
    );

    createRipple(
      event.clientX,
      event.clientY,
      RIPPLE_STRENGTH
      );
playRippleSound();
  }

  function handlePointerMove(event) {
    if (!pointerDown) return;

    const currentTime =
      performance.now();

    const distance =
      Math.hypot(
        event.clientX - lastPointerX,
        event.clientY - lastPointerY
      );

    /*
      드래그 중에는 물결을 너무 많이 만들지 않도록
      간격을 넉넉하게 제한한다.
    */
    if (
      currentTime - lastRippleTime >= 180 &&
      distance >= 35
    ) {
      createRipple(
        event.clientX,
        event.clientY,
        RIPPLE_STRENGTH * 0.65
      );

      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      lastRippleTime = currentTime;
    }
  }

  function handlePointerUp(event) {
    pointerDown = false;

    canvas.releasePointerCapture?.(
      event.pointerId
    );
  }

  canvas.addEventListener(
    "pointerdown",
    handlePointerDown
  );

  canvas.addEventListener(
    "pointermove",
    handlePointerMove
  );

  canvas.addEventListener(
    "pointerup",
    handlePointerUp
  );

  canvas.addEventListener(
    "pointercancel",
    handlePointerUp
  );

  canvas.addEventListener(
    "pointerleave",
    handlePointerUp
  );

  window.addEventListener(
    "resize",
    () => {
      resizeCanvas();
      loadImage();
    }
  );

  function render(now) {
    resizeCanvas();

    if (
      imageTexture &&
      loadedImage
    ) {
      const elapsed =
        (now - startTime) / 1000;

      gl.clearColor(
        0.87,
        0.91,
        0.80,
        1
      );

      gl.clear(
        gl.COLOR_BUFFER_BIT
      );

      gl.activeTexture(
        gl.TEXTURE0
      );

      gl.bindTexture(
        gl.TEXTURE_2D,
        imageTexture
      );

      gl.uniform1i(
        imageLocation,
        0
      );

      gl.uniform1f(
        timeLocation,
        elapsed
      );

      gl.uniform2fv(
        rippleCenterLocation,
        rippleCenters
      );

      gl.uniform1fv(
        rippleStartLocation,
        rippleStarts
      );

      gl.uniform1fv(
        rippleStrengthLocation,
        rippleStrengths
      );

      gl.drawArrays(
        gl.TRIANGLES,
        0,
        6
      );
    }

    requestAnimationFrame(render);
  }

  function createShader(type, source) {
    const shader =
      gl.createShader(type);

    gl.shaderSource(
      shader,
      source
    );

    gl.compileShader(shader);

    if (
      !gl.getShaderParameter(
        shader,
        gl.COMPILE_STATUS
      )
    ) {
      console.error(
        gl.getShaderInfoLog(shader)
      );

      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  function createProgram(
    vertexSource,
    fragmentSource
  ) {
    const vertexShader =
      createShader(
        gl.VERTEX_SHADER,
        vertexSource
      );

    const fragmentShader =
      createShader(
        gl.FRAGMENT_SHADER,
        fragmentSource
      );

    if (
      !vertexShader ||
      !fragmentShader
    ) {
      return null;
    }

    const shaderProgram =
      gl.createProgram();

    gl.attachShader(
      shaderProgram,
      vertexShader
    );

    gl.attachShader(
      shaderProgram,
      fragmentShader
    );

    gl.linkProgram(shaderProgram);

    if (
      !gl.getProgramParameter(
        shaderProgram,
        gl.LINK_STATUS
      )
    ) {
      console.error(
        gl.getProgramInfoLog(
          shaderProgram
        )
      );

      gl.deleteProgram(
        shaderProgram
      );

      return null;
    }

    return shaderProgram;
  }

  function createImageTexture(image) {
    const texture =
      gl.createTexture();

    gl.bindTexture(
      gl.TEXTURE_2D,
      texture
    );

    gl.pixelStorei(
      gl.UNPACK_FLIP_Y_WEBGL,
      true
    );

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR
    );

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      gl.LINEAR
    );

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      gl.CLAMP_TO_EDGE
    );

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      gl.CLAMP_TO_EDGE
    );

    return texture;
  }

  function showFallback(message) {
    console.error(message);

    document.body.style.backgroundImage =
      `url("${chooseImageSource()}")`;

    document.body.style.backgroundSize =
      "cover";

    document.body.style.backgroundPosition =
      "center";

    if (loading) {
      loading.textContent = message;
    }
  }

  resizeCanvas();
  loadImage();
  requestAnimationFrame(render);
})();