/**
 * NoManSucode - Procedural Universe & Spherical Planet Generator
 * Membangkitkan bintang induk, 5 planet bulat 3D dengan permukaan gunung/lembah, lautan, cincin planet,
 * stasiun luar angkasa, sabuk asteroid, dan node sumber daya yang bisa ditambang.
 */
class ProceduralPlanet {
    constructor(config, noiseGen, scene) {
        this.name = config.name;
        this.biome = config.biome;
        this.desc = config.desc;
        this.radius = config.radius;
        this.position = config.position.clone();
        this.gravity = config.gravity || 9.8;
        this.temp = config.temp || "22°C";
        this.hazardRate = config.hazardRate || 0.2;
        this.atmosColor = config.atmosColor;
        this.waterLevel = config.waterLevel || 0;
        this.heightScale = config.heightScale || 10.0;
        this.noiseFreq = config.noiseFreq || 1.6;
        this.seedOffset = config.seedOffset || 0;
        this.colors = config.colors;
        this.hasRings = config.hasRings || false;

        this.noiseGen = noiseGen;
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.scene.add(this.group);

        this.resourceNodes = [];
        this.buildings = [];

        this.buildPlanetMesh();
        this.buildAtmosphereAndWater();
        if (this.hasRings) this.buildPlanetaryRing();
        this.populateSurfaceResources(config.nodeCount || 95);
    }

    // Fungsi tinggi permukaan di arah vektor normal lokal (unit sphere)
    getSurfaceRadiusAtDir(normalDir) {
        const nx = normalDir.x * this.noiseFreq + this.seedOffset;
        const ny = normalDir.y * this.noiseFreq + this.seedOffset;
        const nz = normalDir.z * this.noiseFreq + this.seedOffset;

        const n = this.noiseGen.fbm3D(nx, ny, nz, 4, 2.15, 0.5);
        // Bentuk bukit & dataran
        const ridge = Math.abs(this.noiseGen.noise3D(nx * 2.2, ny * 2.2, nz * 2.2));
        const combined = n * 0.78 + (ridge - 0.35) * 0.22;
        return this.radius + combined * this.heightScale;
    }

    buildPlanetMesh() {
        // Icosahedron resolusi tinggi (detail=32) agar permukaan planet bulat mulus & bergelombang
        const geom = new THREE.IcosahedronGeometry(this.radius, 28);
        const posAttr = geom.attributes.position;
        const vertexCount = posAttr.count;
        const colors = new Float32Array(vertexCount * 3);

        const tempVec = new THREE.Vector3();
        const colLow = new THREE.Color(this.colors.low);
        const colMid = new THREE.Color(this.colors.mid);
        const colHigh = new THREE.Color(this.colors.high);
        const colPeak = new THREE.Color(this.colors.peak);
        const workCol = new THREE.Color();

        for (let i = 0; i < vertexCount; i++) {
            tempVec.fromBufferAttribute(posAttr, i).normalize();
            const hRadius = this.getSurfaceRadiusAtDir(tempVec);
            posAttr.setXYZ(i, tempVec.x * hRadius, tempVec.y * hRadius, tempVec.z * hRadius);

            // Warna berdasarkan ketinggian vertex terhadap radius dasar
            const deltaH = (hRadius - this.radius) / this.heightScale; // sekitar [-0.8, 0.8]
            if (deltaH < -0.15) {
                workCol.copy(colLow);
            } else if (deltaH < 0.2) {
                const t = (deltaH + 0.15) / 0.35;
                workCol.copy(colLow).lerp(colMid, Math.max(0, Math.min(1, t)));
            } else if (deltaH < 0.5) {
                const t = (deltaH - 0.2) / 0.3;
                workCol.copy(colMid).lerp(colHigh, Math.max(0, Math.min(1, t)));
            } else {
                workCol.copy(colPeak);
            }

            colors[i * 3] = workCol.r;
            colors[i * 3 + 1] = workCol.g;
            colors[i * 3 + 2] = workCol.b;
        }

        geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geom.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.82,
            metalness: 0.08,
            flatShading: true
        });

        this.terrainMesh = new THREE.Mesh(geom, mat);
        this.group.add(this.terrainMesh);
    }

    buildAtmosphereAndWater() {
        // Lautan / Lava cair jika planet punya waterLevel > 0
        if (this.waterLevel > 0) {
            const waterGeom = new THREE.SphereGeometry(this.radius - 1.2 + this.waterLevel, 36, 36);
            const waterMat = new THREE.MeshStandardMaterial({
                color: this.colors.water || 0x0284c7,
                transparent: true,
                opacity: 0.76,
                roughness: 0.2,
                metalness: 0.3
            });
            this.waterMesh = new THREE.Mesh(waterGeom, waterMat);
            this.group.add(this.waterMesh);
        }

        // Halo Atmosfer Luar
        const atmosGeom = new THREE.SphereGeometry(this.radius + this.heightScale + 18, 36, 36);
        const atmosMat = new THREE.MeshBasicMaterial({
            color: this.atmosColor,
            transparent: true,
            opacity: 0.16,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.atmosMesh = new THREE.Mesh(atmosGeom, atmosMat);
        this.group.add(this.atmosMesh);
    }

    buildPlanetaryRing() {
        const ringGeom = new THREE.RingGeometry(this.radius * 1.45, this.radius * 2.15, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: this.atmosColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.32
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = Math.PI * 0.42;
        ringMesh.rotation.y = Math.PI * 0.12;
        this.group.add(ringMesh);
    }

    populateSurfaceResources(count) {
        const upDefault = new THREE.Vector3(0, 1, 0);
        const normal = new THREE.Vector3();

        // Shared geometries agar hemat memori WebGL
        const rockGeom = new THREE.DodecahedronGeometry(1.7, 0);
        const crystalGeom = new THREE.ConeGeometry(1.1, 4.2, 5);
        const treeTrunkGeom = new THREE.CylinderGeometry(0.35, 0.55, 2.8, 6);
        const treeCrownGeom = new THREE.IcosahedronGeometry(2.1, 0);
        const shardGeom = new THREE.OctahedronGeometry(1.9, 0);

        for (let i = 0; i < count; i++) {
            // Distribusi merata di bola menggunakan Golden Spiral + jitter acak
            const u = this.noiseGen.randomRange(-1, 1);
            const theta = this.noiseGen.randomRange(0, Math.PI * 2);
            const sqrtOneMinusU2 = Math.sqrt(1 - u * u);

            normal.set(
                sqrtOneMinusU2 * Math.cos(theta),
                u,
                sqrtOneMinusU2 * Math.sin(theta)
            ).normalize();

            const surfaceR = this.getSurfaceRadiusAtDir(normal);
            // Jangan taruh pohon di bawah dasar laut dalam
            if (this.waterLevel > 0 && surfaceR < this.radius - 1.5) continue;

            const roll = this.noiseGen.random();
            let resType = "FERRITE";
            let label = "Batuan Ferrite";
            let meshObj = null;
            let hp = 100;
            let yieldAmount = 14;

            if (roll < 0.34) {
                resType = "FERRITE";
                label = "Batuan Ferrite";
                const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, flatShading: true, roughness: 0.9 });
                meshObj = new THREE.Mesh(rockGeom, mat);
                const s = this.noiseGen.randomRange(0.9, 2.1);
                meshObj.scale.set(s, s * 0.8, s);
                yieldAmount = 16;
            } else if (roll < 0.65) {
                resType = "CARBON";
                label = "Flora Xeno-Carbon";
                meshObj = new THREE.Group();
                const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, flatShading: true });
                const crownMat = new THREE.MeshStandardMaterial({
                    color: this.colors.flora || 0x10b981,
                    emissive: this.colors.flora || 0x10b981,
                    emissiveIntensity: 0.18,
                    flatShading: true
                });
                const trunk = new THREE.Mesh(treeTrunkGeom, trunkMat);
                trunk.position.y = 1.4;
                const crown = new THREE.Mesh(treeCrownGeom, crownMat);
                crown.position.y = 3.6;
                meshObj.add(trunk);
                meshObj.add(crown);
                const s = this.noiseGen.randomRange(1.0, 1.8);
                meshObj.scale.set(s, s, s);
                yieldAmount = 18;
            } else if (roll < 0.87) {
                resType = "COBALT";
                label = "Kristal Cobalt Murni";
                const mat = new THREE.MeshStandardMaterial({
                    color: 0x38bdf8,
                    emissive: 0x0284c7,
                    emissiveIntensity: 0.45,
                    flatShading: true,
                    roughness: 0.2
                });
                meshObj = new THREE.Mesh(crystalGeom, mat);
                const s = this.noiseGen.randomRange(1.0, 1.8);
                meshObj.scale.set(s, s, s);
                yieldAmount = 12;
            } else {
                resType = "SUCODE";
                label = "Monolit Sucode Shard";
                const mat = new THREE.MeshStandardMaterial({
                    color: 0xe879f9,
                    emissive: 0xc026d3,
                    emissiveIntensity: 0.65,
                    flatShading: true,
                    metalness: 0.6,
                    roughness: 0.15
                });
                meshObj = new THREE.Mesh(shardGeom, mat);
                const s = this.noiseGen.randomRange(1.1, 1.9);
                meshObj.scale.set(s, s * 1.4, s);
                hp = 130;
                yieldAmount = 8;
            }

            // Tempatkan di permukaan bola planet & rotasikan tegak lurus terhadap normal permukaan
            const localPos = normal.clone().multiplyScalar(surfaceR);
            meshObj.position.copy(localPos);
            meshObj.quaternion.setFromUnitVectors(upDefault, normal);

            this.group.add(meshObj);

            this.resourceNodes.push({
                id: `${this.name}-res-${i}`,
                planet: this,
                type: resType,
                label: label,
                mesh: meshObj,
                localPos: localPos,
                worldPos: localPos.clone().add(this.position),
                hp: hp,
                maxHp: hp,
                yieldAmount: yieldAmount,
                alive: true
            });
        }
    }
}

class SolarSystemUniverse {
    constructor(scene, seedStr = "SUCODE-2026") {
        this.scene = scene;
        this.seedStr = seedStr;
        this.noiseGen = new SeededNoise(seedStr);
        this.planets = [];
        this.asteroids = [];
        this.spaceStation = null;

        this.buildStarfield();
        this.buildCentralSun();
        this.buildPlanets();
        this.buildSpaceStation();
        this.buildAsteroidBelt(220);
    }

    buildStarfield() {
        const starCount = 4500;
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const r = 6500 + Math.random() * 4000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            const c = 0.75 + Math.random() * 0.25;
            colors[i * 3] = c;
            colors[i * 3 + 1] = c;
            colors[i * 3 + 2] = Math.min(1, c + 0.15);
        }

        geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 6.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.9
        });

        this.starfield = new THREE.Points(geom, mat);
        this.scene.add(this.starfield);
    }

    buildCentralSun() {
        this.sunPos = new THREE.Vector3(-2400, 750, -2600);
        const sunGeom = new THREE.SphereGeometry(240, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        this.sunMesh = new THREE.Mesh(sunGeom, sunMat);
        this.sunMesh.position.copy(this.sunPos);
        this.scene.add(this.sunMesh);

        // Corona Glow
        const glowGeom = new THREE.SphereGeometry(310, 32, 32);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            opacity: 0.28,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });
        const glowMesh = new THREE.Mesh(glowGeom, glowMat);
        this.sunMesh.add(glowMesh);

        // Cahaya Matahari Utama
        const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
        sunLight.position.copy(this.sunPos);
        this.scene.add(sunLight);

        const ambient = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.55);
        this.scene.add(ambient);
    }

    buildPlanets() {
        const jx = () => this.noiseGen.randomRange(-120, 120);

        const planetConfigs = [
            {
                name: "TERRA-PRIME",
                biome: "Bioma Tropis & Samudra Xeno",
                desc: "Kaya Flora Carbon • Cuaca Stabil",
                radius: 175,
                position: new THREE.Vector3(0, 0, -480),
                gravity: 9.8,
                temp: "24°C",
                hazardRate: 0.05,
                atmosColor: 0x38bdf8,
                waterLevel: 1.4,
                heightScale: 13.5,
                noiseFreq: 1.5,
                seedOffset: 11.2,
                nodeCount: 115,
                colors: {
                    low: 0xeab308,
                    mid: 0x10b981,
                    high: 0x047857,
                    peak: 0xf8fafc,
                    water: 0x0284c7,
                    flora: 0x34d399
                }
            },
            {
                name: "PYROS-IV",
                biome: "Bioma Vulkanik & Sungai Magma",
                desc: "Suhu Ekstrem • Kaya Batuan Ferrite & Cobalt",
                radius: 150,
                position: new THREE.Vector3(820 + jx(), 140, -1080 + jx()),
                gravity: 11.2,
                temp: "410°C (Panas Ekstrem)",
                hazardRate: 1.35,
                atmosColor: 0xf97316,
                waterLevel: 0.9,
                heightScale: 16.0,
                noiseFreq: 1.85,
                seedOffset: 47.8,
                nodeCount: 95,
                colors: {
                    low: 0x7c2d12,
                    mid: 0x451a03,
                    high: 0x991b1b,
                    peak: 0xfbbf24,
                    water: 0xea580c,
                    flora: 0xf97316
                }
            },
            {
                name: "CRYO-NOVA",
                biome: "Bioma Glasial & Cincin Es",
                desc: "Badai Beku • Kaya Kristal Cobalt",
                radius: 190,
                position: new THREE.Vector3(-960 + jx(), -180, -1250 + jx()),
                gravity: 8.4,
                temp: "-135°C (Beku)",
                hazardRate: 1.1,
                atmosColor: 0x67e8f9,
                waterLevel: 1.0,
                heightScale: 15.0,
                noiseFreq: 1.45,
                seedOffset: 93.4,
                hasRings: true,
                nodeCount: 110,
                colors: {
                    low: 0x0e7490,
                    mid: 0xa5f3fc,
                    high: 0xe0f2fe,
                    peak: 0xffffff,
                    water: 0x0891b2,
                    flora: 0x22d3ee
                }
            },
            {
                name: "TOX-VORTEX",
                biome: "Bioma Spora Asam & Rawa Mutasi",
                desc: "Atmosfer Korosif • Kaya Flora & Sucode",
                radius: 145,
                position: new THREE.Vector3(-580 + jx(), 320, 620 + jx()),
                gravity: 9.0,
                temp: "68°C (Asam)",
                hazardRate: 1.25,
                atmosColor: 0xa855f7,
                waterLevel: 1.2,
                heightScale: 12.0,
                noiseFreq: 2.0,
                seedOffset: 154.1,
                nodeCount: 95,
                colors: {
                    low: 0x3b0764,
                    mid: 0x6b21a8,
                    high: 0x84cc16,
                    peak: 0xd9f99d,
                    water: 0x65a30d,
                    flora: 0xc084fc
                }
            },
            {
                name: "AETHER-CORE",
                biome: "Planet Anomali Siber Sucode",
                desc: "Gravitasi Rendah • Melimpah Monolit Sucode Shard",
                radius: 135,
                position: new THREE.Vector3(780 + jx(), -260, 560 + jx()),
                gravity: 5.5,
                temp: "-15°C (Anomali Kuantum)",
                hazardRate: 0.4,
                atmosColor: 0xe879f9,
                waterLevel: 0,
                heightScale: 14.5,
                noiseFreq: 2.3,
                seedOffset: 219.7,
                hasRings: true,
                nodeCount: 105,
                colors: {
                    low: 0x0f172a,
                    mid: 0x1e1b4b,
                    high: 0x701a75,
                    peak: 0xf0abfc,
                    flora: 0xe879f9
                }
            }
        ];

        for (const cfg of planetConfigs) {
            const p = new ProceduralPlanet(cfg, this.noiseGen, this.scene);
            this.planets.push(p);
        }
    }

    buildSpaceStation() {
        const stationGroup = new THREE.Group();
        stationGroup.position.set(240, 120, -180);

        const coreGeom = new THREE.OctahedronGeometry(26, 1);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            metalness: 0.75,
            roughness: 0.25,
            flatShading: true
        });
        const core = new THREE.Mesh(coreGeom, coreMat);
        stationGroup.add(core);

        const ringGeom = new THREE.TorusGeometry(44, 4.5, 12, 48);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.45,
            metalness: 0.6
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        stationGroup.add(ring);

        this.scene.add(stationGroup);
        this.spaceStation = {
            name: "STASIUN ORBIT NEXUS-9",
            group: stationGroup,
            ring: ring,
            position: stationGroup.position,
            radius: 52
        };
    }

    buildAsteroidBelt(count = 200) {
        const astGeom = new THREE.DodecahedronGeometry(4.5, 0);
        for (let i = 0; i < count; i++) {
            const angle = this.noiseGen.randomRange(0, Math.PI * 2);
            const dist = this.noiseGen.randomRange(340, 620);
            const y = this.noiseGen.randomRange(-140, 140);

            const isCobalt = this.noiseGen.random() > 0.72;
            const mat = new THREE.MeshStandardMaterial({
                color: isCobalt ? 0x38bdf8 : 0x64748b,
                emissive: isCobalt ? 0x0369a1 : 0x000000,
                emissiveIntensity: isCobalt ? 0.35 : 0,
                flatShading: true,
                roughness: 0.85
            });

            const mesh = new THREE.Mesh(astGeom, mat);
            mesh.position.set(
                Math.cos(angle) * dist,
                y,
                -480 + Math.sin(angle) * dist
            );
            const s = this.noiseGen.randomRange(0.7, 2.4);
            mesh.scale.set(s, s * 0.85, s * 1.15);
            mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);

            this.scene.add(mesh);
            this.asteroids.push({
                mesh: mesh,
                type: isCobalt ? "COBALT" : "FERRITE",
                yieldAmount: isCobalt ? 15 : 18,
                hp: 60,
                alive: true,
                rotSpeed: this.noiseGen.randomRange(0.2, 1.0)
            });
        }
    }

    update(dt) {
        if (this.spaceStation) {
            this.spaceStation.ring.rotation.z += dt * 0.35;
            this.spaceStation.group.rotation.y += dt * 0.12;
        }
        for (const ast of this.asteroids) {
            if (ast.alive) {
                ast.mesh.rotation.x += dt * 0.25 * ast.rotSpeed;
                ast.mesh.rotation.y += dt * 0.35 * ast.rotSpeed;
            }
        }
    }
}

window.SolarSystemUniverse = SolarSystemUniverse;
