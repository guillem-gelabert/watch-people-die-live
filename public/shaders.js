// GLSL for the realistic earth, adapted from Bruno Simon's Three.js Journey
// "Earth shaders" lesson. Day/night blend by sun orientation, clouds, fresnel
// atmosphere rim, and ocean specular — plus a separate back-side atmosphere glow.
// Inlined as strings because the site ships plain ES modules with no bundler.

export const earthVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main()
{
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    vec3 modelNormal = (modelMatrix * vec4(normal, 0.0)).xyz;

    vUv = uv;
    vNormal = modelNormal;
    vPosition = modelPosition.xyz;
}
`;

export const earthFragmentShader = /* glsl */ `
uniform sampler2D uDayTexture;
uniform sampler2D uNightTexture;
uniform sampler2D uSpecularCloudsTexture;
uniform vec3 uSunDirection;
uniform vec3 uAtmosphereDayColor;
uniform vec3 uAtmosphereTwilightColor;

// --- Death shockwaves -------------------------------------------------------
// Each active death blast refracts the surface like a single water ripple: an
// expanding ring that displaces the texture-sampling UV outward/inward, then
// dissipates. Centres are in texture UV; progress is 0->1 over the ripple life.
// N_BLASTS MUST match N_BLASTS in public/app.js.
#define N_BLASTS 16
uniform int uBlastCount;
uniform vec2 uBlastUv[N_BLASTS];
uniform float uBlastProg[N_BLASTS];

const float BLAST_MAXR = 0.10;  // max ripple radius (texture v-units; ~18 deg)
const float BLAST_WIDTH = 0.022; // crest thickness (narrower = tighter ring)
const float BLAST_AMP = 0.0032; // max UV displacement (subtle)

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main()
{
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);
    vec3 color = vec3(0.0);

    // Death shockwaves: accumulate a refraction offset (and a faint crest) from
    // every active ripple, then sample the surface textures through it.
    vec2 uvOffset = vec2(0.0);
    float crest = 0.0;
    if (uBlastCount > 0)
    {
        float lat = (vUv.y - 0.5) * 3.141592653589793;
        float coslat = max(cos(lat), 0.15); // longitudes compress toward the poles
        for (int i = 0; i < N_BLASTS; i++)
        {
            if (i >= uBlastCount) break;
            vec2 d = vUv - uBlastUv[i];
            d.x -= round(d.x);              // wrap the longitude seam (u in [0,1])
            vec2 dd = vec2(d.x * 2.0 * coslat, d.y); // u spans 2x the degrees of v
            float dist = length(dd);
            float prog = uBlastProg[i];
            float radius = prog * BLAST_MAXR;
            float x = (dist - radius) / BLAST_WIDTH;
            float wave = -x * exp(-x * x);  // one push-out/pull-in lobe = single ripple
            float fade = (1.0 - prog) * (1.0 - prog);
            vec2 dir = dist > 1e-4 ? dd / dist : vec2(0.0);
            uvOffset += dir * wave * BLAST_AMP * fade;
            crest += exp(-x * x) * fade;
        }
    }
    vec2 uv = vUv + uvOffset;

    // Sun orientation
    float sunOrientation = dot(uSunDirection, normal);

    // Day / night color
    float dayMix = smoothstep(- 0.25, 0.5, sunOrientation);
    vec3 dayColor = texture(uDayTexture, uv).rgb;
    vec3 nightColor = texture(uNightTexture, uv).rgb;
    color = mix(nightColor, dayColor, dayMix);

    // Specular cloud color
    vec2 specularCloudsColor = texture(uSpecularCloudsTexture, uv).rg;

    // Clouds
    float cloudsMix = smoothstep(0.5, 1.0, specularCloudsColor.g);
    cloudsMix *= dayMix;
    color = mix(color, vec3(1.0), cloudsMix);

    // Fresnel
    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 2.0);

    // Atmosphere
    float atmosphereDayMix = smoothstep(- 0.5, 1.0, sunOrientation);
    vec3 atmosphereColor = mix(uAtmosphereTwilightColor, uAtmosphereDayColor, atmosphereDayMix);
    color = mix(color, atmosphereColor, fresnel * atmosphereDayMix);

    // Specular
    vec3 reflection = reflect(- uSunDirection, normal);
    float specular = - dot(reflection, viewDirection);
    specular = max(specular, 0.0);
    specular = pow(specular, 32.0);
    specular *= specularCloudsColor.r;

    vec3 specularColor = mix(vec3(1.0), atmosphereColor, fresnel);
    color += specular * specularColor;

    // Faint white glint along the ripple crest so the distortion catches light.
    color += vec3(clamp(crest, 0.0, 1.0)) * 0.05;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

export const atmosphereVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;

void main()
{
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    vec3 modelNormal = (modelMatrix * vec4(normal, 0.0)).xyz;

    vNormal = modelNormal;
    vPosition = modelPosition.xyz;
}
`;

export const atmosphereFragmentShader = /* glsl */ `
uniform vec3 uSunDirection;
uniform vec3 uAtmosphereDayColor;
uniform vec3 uAtmosphereTwilightColor;

varying vec3 vNormal;
varying vec3 vPosition;

void main()
{
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);
    vec3 color = vec3(0.0);

    float sunOrientation = dot(uSunDirection, normal);

    float atmosphereDayMix = smoothstep(- 0.5, 1.0, sunOrientation);
    vec3 atmosphereColor = mix(uAtmosphereTwilightColor, uAtmosphereDayColor, atmosphereDayMix);
    color = mix(color, atmosphereColor, atmosphereDayMix);
    color += atmosphereColor;

    float edgeAlpha = dot(viewDirection, normal);
    edgeAlpha = smoothstep(0.0, 0.5, edgeAlpha);

    float dayAlpha = smoothstep(- 0.5, 0.0, sunOrientation);

    float alpha = edgeAlpha * dayAlpha;

    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;
