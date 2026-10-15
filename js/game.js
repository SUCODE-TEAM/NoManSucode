/**
 * NoManSucode - Main 3D Game Engine (Three.js)
 * Menggabungkan Penerbangan Pesawat 6-DOF, Transisi Atmosfer Tanpa Loading,
 * Gravitasi Radial Bola Planet 360°, Multi-Tool Laser, dan Sistem Otomatisasi Sucode.
 */
const GameUI = {
    activeModal: null,

    toggleModal(modalId) {
        const el = document.getElementById(modalId);
        if (!el) return;
        const isHidden = el.classList.contains("hidden");
        this.closeAllModals();
        if (isHidden) {
            el.classList.remove("hidden");
            this.activeModal = modalId;
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
            if (modalId === "modal-upgrade" && window.Game) {
                window.Game.renderPlanetDirectory();
            }
        }
    },

    closeAllModals() {
        document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.add("hidden"));
        this.activeModal = null;
    }
};
window.GameUI = GameUI;

class NoManSucodeGame {
    constructor() {
        this.container = document.getElementById("game-container");
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x030712, 0.00012);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.2, 14000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.isRunning = false;
        this.mode = "SHIP"; // "SHIP" atau "FOOT"
        this.thirdPerson = true;

        // Inventaris & Statistik Pemain
        this.inventory = {
            FERRITE: 60,
            CARBON: 60,
            COBALT: 30,
            SUCODE: 15
        };

        this.stats = {
            shield: 100,
            energy: 100,
            hazard: 100
        };

        this.upgrades = {
            laser: 1,
            engine: 1,
            shield: 1
        };

        // Input State
        this.keys = {};
        this.mouseDown = false;
        this.mouseDelta = { x: 0, y: 0 };

        // State Pesawat & Astronot
        this.shipVelocity = new THREE.Vector3();
        this.shipSpeed = 0;
        this.footYaw = 0;
        this.footPitch = 0;
        this.footVerticalVel = 0;
        this.isGrounded = false;
        this.currentPlanet = null;
        this.nearestPlanet = null;
        this.lastDiscoveredPlanetName = "";
        this.autoPilotTarget = null;

        // Objek 3D Pemain & Pesawat
        this.buildStarshipModel();
        this.buildAstronautModel();
        this.buildLaserBeam();

        this.bindEvents();
    }

    startWithSeed(seedStr) {
        // Bersihkan alam semesta lama jika ada
        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }

        this.scene.add(this.shipGroup);
        this.scene.add(this.playerGroup);
        this.scene.add(this.miningLaserLine);

        this.universe = new SolarSystemUniverse(this.scene, seedStr);
        document.getElementById("hud-seed").textContent = seedStr;

        // Posisi awal di dekat Planet Pertama (Terra-Prime)
        this.shipGroup.position.set(0, 45, -195);
        this.shipGroup.lookAt(0, 0, -480);
        this.mode = "SHIP";
        this.playerGroup.visible = false;

        window.SpaceAudio.init();
        this.isRunning = true;
        this.updateHUD();
        this.logActivity(`🌌 Alam Semesta "${seedStr}" berhasil dibangkitkan.`);
        this.logActivity(`🚀 Terbang mendekati planet dan tekan [E] untuk mendarat!`);
    }

    buildStarshipModel() {
        this.shipGroup = new THREE.Group();

        // Badan Utama Pesawat Sci-Fi
        const hullGeom = new THREE.ConeGeometry(2.2, 9.5, 6);
        hullGeom.rotateX(Math.PI / 2);
        const hullMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            metalness: 0.65,
            roughness: 0.25,
            flatShading: true
        });
        const hull = new THREE.Mesh(hullGeom, hullMat);
        this.shipGroup.add(hull);

        // Kaca Kokpit
        const glassGeom = new THREE.BoxGeometry(1.7, 1.1, 3.2);
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.4,
            roughness: 0.1,
            metalness: 0.8
        });
        const cockpit = new THREE.Mesh(glassGeom, glassMat);
        cockpit.position.set(0, 0.85, -0.5);
        this.shipGroup.add(cockpit);

        // Sayap Kiri & Kanan
        const wingGeom = new THREE.BoxGeometry(9.5, 0.35, 3.2);
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            metalness: 0.5,
            roughness: 0.35,
            flatShading: true
        });
        const wings = new THREE.Mesh(wingGeom, wingMat);
        wings.position.set(0, -0.1, 1.2);
        this.shipGroup.add(wings);

        // Cahaya Mesin Thruster Belakang
        const thrusterGeom = new THREE.CylinderGeometry(0.75, 1.05, 1.2, 12);
        thrusterGeom.rotateX(Math.PI / 2);
        this.thrusterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        this.thrusterMesh = new THREE.Mesh(thrusterGeom, this.thrusterMat);
        this.thrusterMesh.position.set(0, 0, 4.8);
        this.shipGroup.add(this.thrusterMesh);

        this.scene.add(this.shipGroup);
    }

    buildAstronautModel() {
        this.playerGroup = new THREE.Group();

        // Pivot kamera & badan astronot
        this.astronautVisual = new THREE.Group();

        const suitMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, flatShading: true });
        const visorMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.5,
            roughness: 0.1
        });
        const packMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, flatShading: true });

        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.55, 1.9, 8), suitMat);
        torso.position.y = 1.1;
        this.astronautVisual.add(torso);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), suitMat);
        head.position.y = 2.45;
        this.astronautVisual.add(head);

        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.38, 0.45), visorMat);
        visor.position.set(0, 2.48, -0.35);
        this.astronautVisual.add(visor);

        const jetpack = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.2, 0.5), packMat);
        jetpack.position.set(0, 1.25, 0.52);
        this.astronautVisual.add(jetpack);

        this.playerGroup.add(this.astronautVisual);
        this.playerGroup.visible = false;
        this.scene.add(this.playerGroup);
    }

    buildLaserBeam() {
        const pts = [new THREE.Vector3(), new THREE.Vector3(0, 0, -10)];
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 });
        this.miningLaserLine = new THREE.Line(geom, mat);
        this.miningLaserLine.visible = false;
        this.scene.add(this.miningLaserLine);
    }

    bindEvents() {
        window.addEventListener("resize", () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Tombol Random Seed & Launch di Menu Awal
        document.getElementById("btn-random-seed").addEventListener("click", () => {
            const prefixes = ["SUCODE", "HELIOS", "AETHER", "ANDROMEDA", "CYBER", "VORTEX"];
            const p = prefixes[Math.floor(Math.random() * prefixes.length)];
            const num = Math.floor(1000 + Math.random() * 9000);
            document.getElementById("galaxy-seed").value = `${p}-${num}`;
        });

        document.getElementById("btn-launch-game").addEventListener("click", () => {
            const seedVal = document.getElementById("galaxy-seed").value.trim() || "SUCODE-2026";
            document.getElementById("start-screen").classList.add("hidden");
            document.getElementById("hud").classList.remove("hidden");
            this.startWithSeed(seedVal);
            this.renderer.domElement.requestPointerLock();
        });

        // Pointer Lock saat klik layar kanvas
        this.renderer.domElement.addEventListener("click", () => {
            if (!this.isRunning || GameUI.activeModal) return;
            if (!document.pointerLockElement) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        window.addEventListener("mousedown", (e) => {
            if (e.button === 0 && document.pointerLockElement) {
                this.mouseDown = true;
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                this.mouseDown = false;
                this.miningLaserLine.visible = false;
                document.getElementById("mining-progress-wrap").classList.add("hidden");
            }
        });

        window.addEventListener("mousemove", (e) => {
            if (document.pointerLockElement !== this.renderer.domElement) return;
            this.mouseDelta.x += e.movementX;
            this.mouseDelta.y += e.movementY;
        });

        window.addEventListener("keydown", (e) => {
            const code = e.code;
            this.keys[code] = true;

            if (!this.isRunning) return;

            // Pintasan Keyboard jika tidak sedang mengetik di textarea Sucode
            if (document.activeElement && document.activeElement.tagName === "TEXTAREA") return;

            if (code === "KeyC") {
                GameUI.toggleModal("modal-sucode");
            } else if (code === "KeyI") {
                GameUI.toggleModal("modal-upgrade");
            } else if (code === "KeyQ") {
                this.triggerScan();
            } else if (code === "KeyB") {
                this.buildBeacon();
            } else if (code === "KeyV") {
                this.toggleCameraView();
            } else if (code === "KeyE") {
                this.handleInteractE();
            } else if (code === "KeyX" && this.mode === "FOOT") {
                this.summonShipToPlayer();
            }
        });

        window.addEventListener("keyup", (e) => {
            this.keys[e.code] = false;
        });
    }

    getActivePosition() {
        return this.mode === "SHIP" ? this.shipGroup.position : this.playerGroup.position;
    }

    toggleCameraView() {
        this.thirdPerson = !this.thirdPerson;
        this.logActivity(`📷 Mode Kamera: ${this.thirdPerson ? "Third-Person (Luar)" : "First-Person (Kokpit/Visor)"}`);
    }

    // Transisi Mendarat dari Pesawat ke Daratan Planet atau Masuk Kembali ke Pesawat
    handleInteractE() {
        if (this.mode === "SHIP") {
            if (!this.nearestPlanet) return;
            const distCenter = this.shipGroup.position.distanceTo(this.nearestPlanet.position);
            const normal = this.shipGroup.position.clone().sub(this.nearestPlanet.position).normalize();
            const surfaceR = this.nearestPlanet.getSurfaceRadiusAtDir(normal);
            const altitude = distCenter - surfaceR;

            if (altitude < 65) {
                // Mendaratkan pesawat dengan mulus di permukaan bola planet
                this.currentPlanet = this.nearestPlanet;
                const landPos = this.currentPlanet.position.clone().add(normal.clone().multiplyScalar(surfaceR + 1.8));
                this.shipGroup.position.copy(landPos);

                // Sejajarkan bagian atas pesawat dengan normal permukaan planet
                const upVec = new THREE.Vector3(0, 1, 0);
                this.shipGroup.quaternion.setFromUnitVectors(upVec, normal);

                // Keluarkan astronot di samping pesawat
                const rightOffset = new THREE.Vector3(5, 0, 0).applyQuaternion(this.shipGroup.quaternion);
                const footPos = landPos.clone().add(rightOffset);
                const footNormal = footPos.clone().sub(this.currentPlanet.position).normalize();
                const footSurfaceR = this.currentPlanet.getSurfaceRadiusAtDir(footNormal);

                this.playerGroup.position.copy(
                    this.currentPlanet.position.clone().add(footNormal.multiplyScalar(footSurfaceR))
                );
                this.playerGroup.quaternion.setFromUnitVectors(upVec, footNormal);
                this.playerGroup.visible = true;

                this.mode = "FOOT";
                this.shipSpeed = 0;
                this.footVerticalVel = 0;
                this.autoPilotTarget = null;

                window.SpaceAudio.playChime("deploy");
                this.showDiscoveryBanner(this.currentPlanet);
                this.logActivity(`🛬 Berhasil mendarat di ${this.currentPlanet.name}!`);
                this.updateModeUI();
            } else {
                this.logActivity(`⚠️ Terlalu tinggi untuk mendarat! Turunkan ketinggian (< 65m dari tanah).`);
            }
        } else if (this.mode === "FOOT") {
            const distToShip = this.playerGroup.position.distanceTo(this.shipGroup.position);
            if (distToShip < 22) {
                // Masuk kembali ke kokpit pesawat
                this.mode = "SHIP";
                this.playerGroup.visible = false;
                // Angkat sedikit dari tanah untuk lepas landas
                const normal = this.shipGroup.position.clone().sub(this.currentPlanet.position).normalize();
                this.shipGroup.position.addScaledVector(normal, 6.0);
                window.SpaceAudio.playChime("pickup");
                this.logActivity(`🚀 Masuk ke kokpit pesawat. Tekan [W] untuk lepas landas ke angkasa!`);
                this.updateModeUI();
            } else {
                this.logActivity(`⚠️ Terlalu jauh dari pesawat (${Math.round(distToShip)}m). Mendekatlah atau tekan [X] untuk memanggil pesawat.`);
            }
        }
    }

    summonShipToPlayer() {
        if (this.mode !== "FOOT" || !this.currentPlanet) return;
        const normal = this.playerGroup.position.clone().sub(this.currentPlanet.position).normalize();
        const forward = new THREE.Vector3(0, 0, -10).applyQuaternion(this.playerGroup.quaternion);
        const targetPos = this.playerGroup.position.clone().add(forward);
        const shipNormal = targetPos.clone().sub(this.currentPlanet.position).normalize();
        const surfaceR = this.currentPlanet.getSurfaceRadiusAtDir(shipNormal);

        this.shipGroup.position.copy(
            this.currentPlanet.position.clone().add(shipNormal.clone().multiplyScalar(surfaceR + 1.8))
        );
        this.shipGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), shipNormal);
        window.SpaceAudio.playChime("deploy");
        this.logActivity(`📡 Pesawat antariksa dipanggil ke koordinat Anda!`);
    }

    updateModeUI() {
        const isShip = this.mode === "SHIP";
        document.getElementById("crosshair-ship").classList.toggle("hidden", !isShip);
        document.getElementById("crosshair-foot").classList.toggle("hidden", isShip);
        document.getElementById("controls-ship").classList.toggle("hidden", !isShip);
        document.getElementById("controls-foot").classList.toggle("hidden", isShip);

        document.getElementById("hud-player-mode").textContent = isShip
            ? "🚀 MODE PESAWAT (STARSHIP)"
            : "👨‍🚀 MODE JELAJAH PLANET (EXOSUIT)";
        document.getElementById("label-energy").textContent = isShip
            ? "⚡ BAHAN BAKAR THRUSTER"
            : "⚡ ENERGI JETPACK & LASER";
    }

    showDiscoveryBanner(planet) {
        const banner = document.getElementById("discovery-banner");
        document.getElementById("discovery-title").textContent = planet.name;
        document.getElementById("discovery-desc").textContent = `${planet.biome} • Gravitasi ${planet.gravity}m/s² • ${planet.temp}`;
        banner.classList.remove("hidden");
        banner.style.animation = "none";
        void banner.offsetWidth;
        banner.style.animation = "fadeInOut 4.2s ease forwards";
    }

    triggerScan() {
        window.SpaceAudio.playScanPulse();
        const pos = this.getActivePosition();

        if (this.nearestPlanet) {
            let aliveCount = 0;
            let sucodeCount = 0;
            for (const n of this.nearestPlanet.resourceNodes) {
                if (n.alive) {
                    aliveCount++;
                    if (n.type === "SUCODE") sucodeCount++;
                }
            }
            this.logActivity(`📡 [RADAR SCAN] ${this.nearestPlanet.name}: Terdeteksi ${aliveCount} deposit sumber daya (${sucodeCount} Monolit Sucode).`);
        } else {
            this.logActivity(`📡 [RADAR SCAN] Memindai sektor ruang hampa... Terdapat ${this.universe.planets.length} planet di sistem ini.`);
        }
    }

    buildBeacon() {
        if (this.inventory.FERRITE < 40 || this.inventory.SUCODE < 10) {
            this.logActivity(`⚠️ Butuh 40 Ferrite & 10 Sucode untuk membangun Kubah Markas Koloni!`);
            return;
        }

        const planet = this.currentPlanet || this.nearestPlanet;
        if (!planet) return;

        const refPos = this.getActivePosition();
        const normal = refPos.clone().sub(planet.position).normalize();
        const surfaceR = planet.getSurfaceRadiusAtDir(normal);
        const dist = refPos.distanceTo(planet.position) - surfaceR;

        if (dist > 45) {
            this.logActivity(`⚠️ Anda harus berada di permukaan planet untuk membangun Kubah Markas!`);
            return;
        }

        this.inventory.FERRITE -= 40;
        this.inventory.SUCODE -= 10;

        // Buat Kubah Koloni 3D & Menara Suar
        const baseGroup = new THREE.Group();
        const domeGeom = new THREE.SphereGeometry(5.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.65,
            metalness: 0.4,
            roughness: 0.1
        });
        const dome = new THREE.Mesh(domeGeom, domeMat);
        baseGroup.add(dome);

        const ringBase = new THREE.Mesh(
            new THREE.CylinderGeometry(5.8, 6.2, 1.2, 16),
            new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6 })
        );
        baseGroup.add(ringBase);

        const beaconBeam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.25, 45, 8),
            new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.65 })
        );
        beaconBeam.position.y = 22.5;
        baseGroup.add(beaconBeam);

        const worldSurfacePos = planet.position.clone().add(normal.clone().multiplyScalar(surfaceR));
        baseGroup.position.copy(worldSurfacePos);
        baseGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        this.scene.add(baseGroup);

        // Isi ulang perisai & cuaca saat membangun markas
        this.stats.shield = 100;
        this.stats.hazard = 100;
        this.stats.energy = 100;

        window.SpaceAudio.playChime("deploy");
        this.updateHUD();
        this.logActivity(`🏗️ Kubah Koloni berhasil dibangun di ${planet.name}! Perisai & Energi dipulihkan.`);
    }

    buyUpgrade(type) {
        if (type === "laser") {
            if (this.inventory.FERRITE < 30 || this.inventory.COBALT < 15) {
                this.logActivity(`⚠️ Sumber daya kurang untuk Upgrade Laser!`);
                return;
            }
            this.inventory.FERRITE -= 30;
            this.inventory.COBALT -= 15;
            this.upgrades.laser++;
            document.getElementById("lvl-laser").textContent = `Lv.${this.upgrades.laser}`;
            this.logActivity(`⚡ Multi-Tool Mining Laser meningkat ke Level ${this.upgrades.laser}!`);
        } else if (type === "engine") {
            if (this.inventory.CARBON < 30 || this.inventory.COBALT < 20) {
                this.logActivity(`⚠️ Sumber daya kurang untuk Upgrade Mesin Kapal!`);
                return;
            }
            this.inventory.CARBON -= 30;
            this.inventory.COBALT -= 20;
            this.upgrades.engine++;
            document.getElementById("lvl-engine").textContent = `Lv.${this.upgrades.engine}`;
            this.logActivity(`🚀 Mesin Hyperdrive meningkat ke Level ${this.upgrades.engine}!`);
        } else if (type === "shield") {
            if (this.inventory.FERRITE < 25 || this.inventory.CARBON < 25) {
                this.logActivity(`⚠️ Sumber daya kurang untuk Upgrade Perisai!`);
                return;
            }
            this.inventory.FERRITE -= 25;
            this.inventory.CARBON -= 25;
            this.upgrades.shield++;
            this.stats.shield = 100;
            this.stats.energy = 100;
            this.stats.hazard = 100;
            document.getElementById("lvl-shield").textContent = `Lv.${this.upgrades.shield}`;
            this.logActivity(`🛡️ Perisai Eksosuit meningkat ke Level ${this.upgrades.shield} & seluruh energi penuh!`);
        }
        window.SpaceAudio.playChime("deploy");
        this.updateHUD();
    }

    renderPlanetDirectory() {
        const container = document.getElementById("planet-directory");
        if (!container || !this.universe) return;
        container.innerHTML = "";

        const playerPos = this.getActivePosition();
        for (const p of this.universe.planets) {
            const dist = Math.round(playerPos.distanceTo(p.position) - p.radius);
            const div = document.createElement("div");
            div.className = "planet-card-item";
            div.innerHTML = `
                <strong>🪐 ${p.name}</strong>
                <small>${p.biome}</small>
                <small>Jarak: ${dist}m • Suhu: ${p.temp}</small>
                <button class="btn-secondary" style="margin-top:4px; padding:5px 8px; font-size:11px;">🎯 Arahkan Auto-Pilot</button>
            `;
            div.querySelector("button").addEventListener("click", () => {
                this.engageAutoPilot(p);
                GameUI.closeAllModals();
            });
            container.appendChild(div);
        }
    }

    engageAutoPilot(planet) {
        if (this.mode === "FOOT") {
            this.logActivity(`⚠️ Masuk ke pesawat [E] terlebih dahulu untuk mengaktifkan Auto-Pilot!`);
            return;
        }
        this.autoPilotTarget = planet;
        this.shipGroup.lookAt(planet.position);
        this.logActivity(`🧭 Auto-Pilot dikunci menuju ${planet.name}!`);
    }

    logActivity(msg) {
        const box = document.getElementById("activity-log");
        if (!box) return;
        const item = document.createElement("div");
        item.className = "log-entry";
        item.textContent = msg;
        box.appendChild(item);
        while (box.children.length > 4) {
            box.removeChild(box.firstChild);
        }
    }

    // ==================== LOOP UPDATE PESAWAT ANTARIKSA ====================
    updateShipMode(dt) {
        const engineBonus = 1 + (this.upgrades.engine - 1) * 0.3;
        const maxNormalSpeed = 85 * engineBonus;
        const maxBoostSpeed = 230 * engineBonus;

        // Rotasi Pitch & Yaw dari Mouse
        const rotSensitivity = 0.0022;
        this.shipGroup.rotateY(-this.mouseDelta.x * rotSensitivity);
        this.shipGroup.rotateX(-this.mouseDelta.y * rotSensitivity);
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;

        // Roll dengan A / D
        const rollSpeed = 1.9;
        if (this.keys["KeyA"]) this.shipGroup.rotateZ(rollSpeed * dt);
        if (this.keys["KeyD"]) this.shipGroup.rotateZ(-rollSpeed * dt);

        // Auto-Pilot jika aktif
        if (this.autoPilotTarget) {
            const distToTarget = this.shipGroup.position.distanceTo(this.autoPilotTarget.position) - this.autoPilotTarget.radius;
            if (distToTarget > 95) {
                this.shipGroup.lookAt(this.autoPilotTarget.position);
                this.shipSpeed = THREE.MathUtils.lerp(this.shipSpeed, maxBoostSpeed * 0.85, dt * 3);
            } else {
                this.logActivity(`✅ Auto-Pilot tiba di orbit ${this.autoPilotTarget.name}. Tekan [E] untuk mendarat.`);
                this.autoPilotTarget = null;
                this.shipSpeed = 15;
            }
        } else {
            // Akselerasi Manual W / S / SHIFT
            const isBoosting = this.keys["ShiftLeft"] || this.keys["ShiftRight"];
            const targetMax = isBoosting && this.stats.energy > 5 ? maxBoostSpeed : maxNormalSpeed;

            if (this.keys["KeyW"]) {
                this.shipSpeed = THREE.MathUtils.lerp(this.shipSpeed, targetMax, dt * 2.5);
                if (isBoosting) {
                    this.stats.energy = Math.max(0, this.stats.energy - dt * 6.5);
                    this.thrusterMat.color.setHex(0xe879f9);
                } else {
                    this.thrusterMat.color.setHex(0x38bdf8);
                }
            } else if (this.keys["KeyS"]) {
                this.shipSpeed = THREE.MathUtils.lerp(this.shipSpeed, -28, dt * 2.5);
            } else if (this.keys["Space"]) {
                this.shipSpeed = THREE.MathUtils.lerp(this.shipSpeed, 0, dt * 5.0);
            } else {
                this.shipSpeed = THREE.MathUtils.lerp(this.shipSpeed, 0, dt * 1.4);
                this.stats.energy = Math.min(100, this.stats.energy + dt * 5.0);
            }
        }

        // Gerakkan pesawat ke arah depan lokal (-Z)
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.shipGroup.quaternion);
        this.shipGroup.position.addScaledVector(forward, this.shipSpeed * dt);

        // Cegah pesawat menembus ke dalam tanah planet
        if (this.nearestPlanet) {
            const toShip = this.shipGroup.position.clone().sub(this.nearestPlanet.position);
            const distCenter = toShip.length();
            const normal = toShip.clone().normalize();
            const surfaceR = this.nearestPlanet.getSurfaceRadiusAtDir(normal);

            if (distCenter < surfaceR + 3.2) {
                this.shipGroup.position.copy(
                    this.nearestPlanet.position.clone().add(normal.multiplyScalar(surfaceR + 3.2))
                );
                this.shipSpeed *= 0.5;
            }
        }

        // Kamera mengikuti pesawat dengan mulus
        if (this.thirdPerson) {
            const camOffset = new THREE.Vector3(0, 4.2, 15.5).applyQuaternion(this.shipGroup.quaternion);
            const desiredCamPos = this.shipGroup.position.clone().add(camOffset);
            this.camera.position.lerp(desiredCamPos, Math.min(1, dt * 12));
            this.camera.quaternion.slerp(this.shipGroup.quaternion, Math.min(1, dt * 12));
        } else {
            const cockpitPos = new THREE.Vector3(0, 1.05, -1.6).applyQuaternion(this.shipGroup.quaternion);
            this.camera.position.copy(this.shipGroup.position).add(cockpitPos);
            this.camera.quaternion.copy(this.shipGroup.quaternion);
        }

        // Tembak Meriam Foton / Laser Tambang Pesawat (Klik Kiri)
        if (this.mouseDown) {
            this.fireMiningOrShipLaser(dt, true);
        } else {
            this.miningLaserLine.visible = false;
        }

        window.SpaceAudio.updateEngineSound(Math.abs(this.shipSpeed) / maxNormalSpeed, true);
    }

    // ==================== LOOP UPDATE JALAN KAKI GRAVITASI BOLA PLANET ====================
    updateFootMode(dt) {
        const planet = this.currentPlanet;
        if (!planet) return;

        // 1. Hitung Vektor Normal Atas (Gravitasi Radial Bola 360 Derajat)
        const upNormal = this.playerGroup.position.clone().sub(planet.position).normalize();

        // 2. Putar Orientasi Lokal Pemain berdasarkan Mouse X (Yaw mengelilingi normal planet) & Mouse Y (Pitch kamera)
        const sensitivity = 0.0024;
        const yawDelta = -this.mouseDelta.x * sensitivity;
        this.footPitch = Math.max(-1.25, Math.min(1.25, this.footPitch - this.mouseDelta.y * sensitivity));
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;

        // Rotasikan quaternion pemain mengelilingi sumbu normal planet
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(upNormal, yawDelta);
        this.playerGroup.quaternion.premultiply(yawQuat);

        // Pastikan sumbu Y lokal pemain selalu tegak lurus dengan permukaan bola planet
        const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.playerGroup.quaternion);
        const alignQuat = new THREE.Quaternion().setFromUnitVectors(currentUp, upNormal);
        this.playerGroup.quaternion.premultiply(alignQuat);

        // 3. Pergerakan W, A, S, D di atas permukaan lengkung planet
        const moveSpeed = (this.keys["ShiftLeft"] || this.keys["ShiftRight"]) ? 19.0 : 12.0;
        const moveLocal = new THREE.Vector3();
        if (this.keys["KeyW"]) moveLocal.z -= 1;
        if (this.keys["KeyS"]) moveLocal.z += 1;
        if (this.keys["KeyA"]) moveLocal.x -= 1;
        if (this.keys["KeyD"]) moveLocal.x += 1;

        if (moveLocal.lengthSq() > 0) {
            moveLocal.normalize();
            const moveWorld = moveLocal.applyQuaternion(this.playerGroup.quaternion);
            this.playerGroup.position.addScaledVector(moveWorld, moveSpeed * dt);
        }

        // 4. Jetpack (SPACE) & Gravitasi Radial ke Pusat Planet
        const newNormal = this.playerGroup.position.clone().sub(planet.position).normalize();
        const surfaceR = planet.getSurfaceRadiusAtDir(newNormal);
        let currentRadius = this.playerGroup.position.distanceTo(planet.position);

        if (this.keys["Space"] && this.stats.energy > 2) {
            this.footVerticalVel = 16.0;
            this.stats.energy = Math.max(0, this.stats.energy - dt * 14);
            this.isGrounded = false;
        } else {
            this.footVerticalVel -= planet.gravity * 2.2 * dt;
            this.stats.energy = Math.min(100, this.stats.energy + dt * 9);
        }

        currentRadius += this.footVerticalVel * dt;

        // Tabrakan dengan tanah permukaan planet
        if (currentRadius <= surfaceR) {
            currentRadius = surfaceR;
            this.footVerticalVel = 0;
            this.isGrounded = true;
        }

        this.playerGroup.position.copy(
            planet.position.clone().add(newNormal.clone().multiplyScalar(currentRadius))
        );

        // 5. Posisi Kamera Astronot (Third-Person / First-Person)
        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.footPitch);
        const camRot = this.playerGroup.quaternion.clone().multiply(pitchQuat);

        if (this.thirdPerson) {
            this.astronautVisual.visible = true;
            const camOffset = new THREE.Vector3(1.1, 3.2, 5.8).applyQuaternion(camRot);
            this.camera.position.copy(this.playerGroup.position).add(camOffset);
            this.camera.quaternion.copy(camRot);
        } else {
            this.astronautVisual.visible = false;
            const eyeOffset = new THREE.Vector3(0, 2.5, 0).applyQuaternion(this.playerGroup.quaternion);
            this.camera.position.copy(this.playerGroup.position).add(eyeOffset);
            this.camera.quaternion.copy(camRot);
        }

        // 6. Tembak Laser Penambang Multi-Tool (Klik Kiri)
        if (this.mouseDown) {
            this.fireMiningOrShipLaser(dt, false);
        } else {
            this.miningLaserLine.visible = false;
            document.getElementById("mining-progress-wrap").classList.add("hidden");
        }

        window.SpaceAudio.updateEngineSound(0, false);
    }

    // ==================== SISTEM MENAMBANG LASER (DARAT & ANGKASA) ====================
    fireMiningOrShipLaser(dt, isShip) {
        const origin = isShip
            ? this.shipGroup.position.clone().add(new THREE.Vector3(0, -0.5, -3).applyQuaternion(this.shipGroup.quaternion))
            : this.playerGroup.position.clone().add(new THREE.Vector3(0.5, 1.8, -0.5).applyQuaternion(this.playerGroup.quaternion));

        const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const maxRange = isShip ? 160 : 42;

        let hitTarget = null;
        let hitDist = maxRange;

        // Cek resource nodes di planet terdekat
        if (this.nearestPlanet) {
            for (const node of this.nearestPlanet.resourceNodes) {
                if (!node.alive) continue;
                const toNode = node.worldPos.clone().sub(this.camera.position);
                const proj = toNode.dot(camForward);
                if (proj > 0 && proj < hitDist) {
                    const perpDistSq = toNode.lengthSq() - proj * proj;
                    if (perpDistSq < 11.5) {
                        hitDist = proj;
                        hitTarget = node;
                    }
                }
            }
        }

        // Cek sabuk asteroid jika di pesawat
        if (!hitTarget && isShip && this.universe) {
            for (const ast of this.universe.asteroids) {
                if (!ast.alive) continue;
                const toAst = ast.mesh.position.clone().sub(this.camera.position);
                const proj = toAst.dot(camForward);
                if (proj > 0 && proj < hitDist) {
                    const perpDistSq = toAst.lengthSq() - proj * proj;
                    if (perpDistSq < 28.0) {
                        hitDist = proj;
                        hitTarget = ast;
                    }
                }
            }
        }

        const endPoint = hitTarget
            ? (hitTarget.worldPos || hitTarget.mesh.position).clone()
            : this.camera.position.clone().addScaledVector(camForward, maxRange);

        // Gambar garis laser 3D
        this.miningLaserLine.visible = true;
        const posArr = this.miningLaserLine.geometry.attributes.position.array;
        posArr[0] = origin.x;
        posArr[1] = origin.y;
        posArr[2] = origin.z;
        posArr[3] = endPoint.x;
        posArr[4] = endPoint.y;
        posArr[5] = endPoint.z;
        this.miningLaserLine.geometry.attributes.position.needsUpdate = true;

        if (Math.random() < 0.25) {
            window.SpaceAudio.playLaser(isShip ? 420 : 640, 190, 0.08);
        }

        const progressWrap = document.getElementById("mining-progress-wrap");
        if (hitTarget) {
            const laserPower = (48 + (this.upgrades.laser - 1) * 22) * (isShip ? 1.3 : 1.0);
            hitTarget.hp -= laserPower * dt;

            progressWrap.classList.remove("hidden");
            document.getElementById("mining-target-label").textContent = hitTarget.label || `Asteroid ${hitTarget.type}`;
            const pct = Math.max(0, Math.min(100, (hitTarget.hp / (hitTarget.maxHp || 60)) * 100));
            document.getElementById("mining-progress-fill").style.width = `${pct}%`;

            // Efek getar halus pada objek yang sedang ditambang
            if (hitTarget.mesh) {
                hitTarget.mesh.rotation.y += dt * 5;
            }

            if (hitTarget.hp <= 0) {
                hitTarget.alive = false;
                if (hitTarget.mesh) hitTarget.mesh.visible = false;
                progressWrap.classList.add("hidden");

                const resType = hitTarget.type;
                const amt = hitTarget.yieldAmount || 15;
                this.inventory[resType] = (this.inventory[resType] || 0) + amt;

                window.SpaceAudio.playChime("pickup");
                this.logActivity(`⛏️ Berhasil menambang +${amt} ${resType}!`);
                this.updateHUD();
            }
        } else {
            progressWrap.classList.add("hidden");
        }
    }

    // ==================== DETEKSI ATMOSFER, CUACA & UPDATE HUD ====================
    updateEnvironmentAndTelemetry(dt) {
        if (!this.universe) return;
        const pos = this.getActivePosition();

        let closestP = null;
        let minSurfaceDist = Infinity;

        for (const p of this.universe.planets) {
            const d = pos.distanceTo(p.position) - p.radius;
            if (d < minSurfaceDist) {
                minSurfaceDist = d;
                closestP = p;
            }
        }

        this.nearestPlanet = closestP;
        const atmosOverlay = document.getElementById("atmosphere-overlay");
        const promptEl = document.getElementById("interaction-prompt");

        if (closestP && minSurfaceDist < 140) {
            // Di dalam atmosfer planet!
            const ratio = Math.max(0, Math.min(1, 1 - minSurfaceDist / 140));
            const hexStr = "#" + closestP.atmosColor.toString(16).padStart(6, "0");
            atmosOverlay.style.background = `radial-gradient(circle, transparent 35%, ${hexStr}44 100%)`;
            atmosOverlay.style.opacity = (ratio * 0.85).toFixed(2);

            document.getElementById("hud-location-type").textContent =
                this.mode === "FOOT" ? "PERMUKAAN PLANET" : "ATMOSFER PLANET";
            document.getElementById("hud-location-name").textContent = closestP.name;
            document.getElementById("hud-biome-info").textContent =
                `${closestP.biome} • Gravitasi ${closestP.gravity}m/s² • ${closestP.temp}`;

            if (this.lastDiscoveredPlanetName !== closestP.name && minSurfaceDist < 75) {
                this.lastDiscoveredPlanetName = closestP.name;
                this.showDiscoveryBanner(closestP);
            }

            // Kerusakan cuaca ekstrem saat di planet berbahaya
            const shieldReduction = 1 / (1 + (this.upgrades.shield - 1) * 0.4);
            this.stats.hazard = Math.max(0, this.stats.hazard - closestP.hazardRate * shieldReduction * dt);
            if (this.stats.hazard <= 0) {
                this.stats.shield = Math.max(5, this.stats.shield - dt * 1.5);
            }

            // Prompt Interaksi [E]
            if (this.mode === "SHIP" && minSurfaceDist < 65) {
                promptEl.textContent = `[E] Mendarat di Permukaan ${closestP.name}`;
                promptEl.classList.remove("hidden");
            } else if (this.mode === "FOOT") {
                const shipDist = this.playerGroup.position.distanceTo(this.shipGroup.position);
                if (shipDist < 22) {
                    promptEl.textContent = `[E] Masuk ke Kokpit Pesawat`;
                    promptEl.classList.remove("hidden");
                } else {
                    promptEl.classList.add("hidden");
                }
            } else {
                promptEl.classList.add("hidden");
            }
        } else {
            // Di Luar Angkasa Lepas (Deep Space)
            atmosOverlay.style.opacity = 0;
            promptEl.classList.add("hidden");
            this.stats.hazard = Math.min(100, this.stats.hazard + dt * 6);

            document.getElementById("hud-location-type").textContent = "DEEP SPACE";
            document.getElementById("hud-location-name").textContent = "SISTEM BINTANG HELIOS";
            document.getElementById("hud-biome-info").textContent = "Ruang Hampa • 0.0G • Suhu -270°C";
        }

        // Update Kompas Planet di Arah Pandang Kamera
        const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        let bestAimPlanet = null;
        let bestDot = 0.85;
        for (const p of this.universe.planets) {
            const dirToP = p.position.clone().sub(this.camera.position).normalize();
            const dot = camForward.dot(dirToP);
            if (dot > bestDot) {
                bestDot = dot;
                bestAimPlanet = p;
            }
        }
        const targetInd = document.getElementById("hud-target-indicator");
        if (bestAimPlanet) {
            const d = Math.max(0, Math.round(pos.distanceTo(bestAimPlanet.position) - bestAimPlanet.radius));
            targetInd.textContent = `🪐 Target Radar: ${bestAimPlanet.name} (${d}m) — ${bestAimPlanet.biome}`;
        } else {
            targetInd.textContent = `🧭 Arahkan moncong pesawat ke planet untuk memindai jarak`;
        }

        // Update Telemetri Bawah
        document.getElementById("hud-speed").textContent =
            this.mode === "SHIP" ? `${Math.round(Math.abs(this.shipSpeed))} u/s` : "JALAN KAKI";
        document.getElementById("hud-altitude").textContent =
            minSurfaceDist < 600 ? `${Math.max(0, Math.round(minSurfaceDist))} m` : "LUAR ANGKASA";
        document.getElementById("hud-ship-dist").textContent =
            this.mode === "SHIP"
                ? "DI KOKPIT"
                : `${Math.round(this.playerGroup.position.distanceTo(this.shipGroup.position))} m`;
    }

    updateHUD() {
        document.getElementById("res-ferrite").textContent = Math.floor(this.inventory.FERRITE);
        document.getElementById("res-carbon").textContent = Math.floor(this.inventory.CARBON);
        document.getElementById("res-cobalt").textContent = Math.floor(this.inventory.COBALT);
        document.getElementById("res-sucode").textContent = Math.floor(this.inventory.SUCODE);

        document.getElementById("bar-shield").style.width = `${Math.round(this.stats.shield)}%`;
        document.getElementById("val-shield").textContent = `${Math.round(this.stats.shield)}%`;

        document.getElementById("bar-energy").style.width = `${Math.round(this.stats.energy)}%`;
        document.getElementById("val-energy").textContent = `${Math.round(this.stats.energy)}%`;

        document.getElementById("bar-hazard").style.width = `${Math.round(this.stats.hazard)}%`;
        document.getElementById("val-hazard").textContent = `${Math.round(this.stats.hazard)}%`;

        document.getElementById("hud-drone-count").textContent = window.SucodeSystem.drones.length;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const dt = Math.min(0.05, this.clock.getDelta());
        const elapsed = this.clock.getElapsedTime();

        if (this.isRunning) {
            if (this.mode === "SHIP") {
                this.updateShipMode(dt);
            } else {
                this.updateFootMode(dt);
            }

            if (this.universe) this.universe.update(dt);
            if (window.SucodeSystem) window.SucodeSystem.updateAll(dt, elapsed);

            this.updateEnvironmentAndTelemetry(dt);

            if (Math.floor(elapsed * 10) % 3 === 0) {
                this.updateHUD();
                document.getElementById("hud-fps").textContent = Math.min(60, Math.round(1 / Math.max(0.008, dt)));
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    window.Game = new NoManSucodeGame();
    window.Game.animate();
});
