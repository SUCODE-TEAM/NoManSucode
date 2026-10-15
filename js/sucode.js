/**
 * NoManSucode - Sistem "Sucode" (Autonomous Drone Programming & Execution Engine)
 * Memungkinkan pemain memprogram perilaku AI Drone penambang menggunakan kode/blok perintah.
 */
class SucodeDrone {
    constructor(id, game, programConfig, spawnPos) {
        this.id = id;
        this.game = game;
        this.config = programConfig;
        this.cargo = { FERRITE: 0, CARBON: 0, COBALT: 0, SUCODE: 0 };
        this.cargoMax = 30;
        this.targetNode = null;
        this.state = "IDLE";
        this.laserTimer = 0;

        this.mesh = this.buildDroneMesh();
        this.mesh.position.copy(spawnPos);
        this.game.scene.add(this.mesh);

        // Garis Laser Penambang Drone
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(),
            new THREE.Vector3(0, 0, -1)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xe879f9, linewidth: 2 });
        this.laserLine = new THREE.Line(lineGeom, lineMat);
        this.laserLine.visible = false;
        this.game.scene.add(this.laserLine);
    }

    buildDroneMesh() {
        const group = new THREE.Group();
        const bodyGeom = new THREE.OctahedronGeometry(1.15, 1);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.4,
            metalness: 0.7,
            roughness: 0.2,
            flatShading: true
        });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        group.add(body);

        const ringGeom = new THREE.TorusGeometry(1.65, 0.14, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xe879f9 });
        this.rotorRing = new THREE.Mesh(ringGeom, ringMat);
        this.rotorRing.rotation.x = Math.PI / 2;
        group.add(this.rotorRing);

        return group;
    }

    update(dt, time) {
        this.rotorRing.rotation.z += dt * 6.0;
        this.laserLine.visible = false;

        const playerPos = this.game.getActivePosition();

        // 1. Fitur Recharge Shield jika diprogram
        if (this.config.rechargeShield && this.game.stats.shield < 100) {
            this.game.stats.shield = Math.min(100, this.game.stats.shield + dt * 2.5);
        }

        // 2. Cek apakah kargo penuh -> transfer otomatis ke pemain
        const totalCargo = this.cargo.FERRITE + this.cargo.CARBON + this.cargo.COBALT + this.cargo.SUCODE;
        if (this.config.autoTransfer && totalCargo >= this.cargoMax) {
            for (const k of Object.keys(this.cargo)) {
                if (this.cargo[k] > 0) {
                    this.game.inventory[k] += Math.floor(this.cargo[k]);
                    this.cargo[k] = 0;
                }
            }
            this.game.logActivity(`🤖 Drone #${this.id} mentransfer hasil tambang ke Inventaris!`);
            this.game.updateHUD();
        }

        // 3. Jika terlalu jauh dari pemain (> 320m), teleport/terbang menyusul pemain
        const distToPlayer = this.mesh.position.distanceTo(playerPos);
        if (distToPlayer > 320) {
            const offset = new THREE.Vector3(Math.sin(time + this.id) * 6, 4, Math.cos(time + this.id) * 6);
            this.mesh.position.copy(playerPos).add(offset);
            this.targetNode = null;
            return;
        }

        // 4. Cari target sumber daya di planet terdekat jika belum ada target
        if (!this.targetNode || !this.targetNode.alive) {
            this.targetNode = this.findNearestResource(playerPos);
        }

        if (this.targetNode && this.targetNode.alive) {
            const targetPos = this.targetNode.worldPos.clone();
            const dist = this.mesh.position.distanceTo(targetPos);

            if (dist > 6.5) {
                // Terbang menuju target sesuai kecepatan di kode Sucode
                const dir = targetPos.clone().sub(this.mesh.position).normalize();
                const moveSpeed = 24 * (this.config.moveSpeed || 1.2);
                this.mesh.position.addScaledVector(dir, moveSpeed * dt);
                this.mesh.lookAt(targetPos);
            } else if (this.config.fireLaser) {
                // Tembakkan laser penambang Drone
                this.laserLine.visible = true;
                const posArr = this.laserLine.geometry.attributes.position.array;
                posArr[0] = this.mesh.position.x;
                posArr[1] = this.mesh.position.y;
                posArr[2] = this.mesh.position.z;
                posArr[3] = targetPos.x;
                posArr[4] = targetPos.y;
                posArr[5] = targetPos.z;
                this.laserLine.geometry.attributes.position.needsUpdate = true;

                this.targetNode.hp -= 38 * dt;
                if (this.targetNode.hp <= 0) {
                    const resType = this.targetNode.type;
                    const amt = this.targetNode.yieldAmount;
                    this.targetNode.alive = false;
                    this.targetNode.mesh.visible = false;

                    if (this.config.autoTransfer) {
                        this.game.inventory[resType] += amt;
                        this.game.logActivity(`🤖 Drone #${this.id} menambang +${amt} ${resType}`);
                        this.game.updateHUD();
                    } else {
                        this.cargo[resType] += amt;
                    }
                    this.targetNode = null;
                }
            }
        } else {
            // Mengorbit lembut di sekitar pemain jika tidak ada target
            const orbitPos = playerPos.clone().add(
                new THREE.Vector3(
                    Math.cos(time * 1.5 + this.id * 2) * 7,
                    3.5 + Math.sin(time * 2 + this.id) * 1.2,
                    Math.sin(time * 1.5 + this.id * 2) * 7
                )
            );
            this.mesh.position.lerp(orbitPos, dt * 3.0);
        }
    }

    findNearestResource(originPos) {
        const nearestPlanet = this.game.nearestPlanet;
        if (!nearestPlanet) return null;

        let best = null;
        let bestDist = 180; // radius scan drone

        for (const node of nearestPlanet.resourceNodes) {
            if (!node.alive) continue;
            if (this.config.targetType !== "ALL" && node.type !== this.config.targetType) continue;

            const d = originPos.distanceTo(node.worldPos);
            if (d < bestDist) {
                bestDist = d;
                best = node;
            }
        }
        return best;
    }
}

const SucodeSystem = {
    drones: [],

    parseProgram(codeText) {
        const upper = (codeText || "").toUpperCase();
        let targetType = "ALL";
        if (upper.includes('SCAN_TARGET("SUCODE")')) targetType = "SUCODE";
        else if (upper.includes('SCAN_TARGET("COBALT")')) targetType = "COBALT";
        else if (upper.includes('SCAN_TARGET("FERRITE")')) targetType = "FERRITE";
        else if (upper.includes('SCAN_TARGET("CARBON")')) targetType = "CARBON";

        let moveSpeed = 1.2;
        const speedMatch = upper.match(/MOVE_TO_TARGET\(([0-9.]+)\)/);
        if (speedMatch && speedMatch[1]) {
            moveSpeed = Math.min(3.0, Math.max(0.4, parseFloat(speedMatch[1])));
        }

        const fireLaser = upper.includes("FIRE_MINING_LASER");
        const autoTransfer = upper.includes("IF_FULL_TRANSFER_TO_PLAYER");
        const rechargeShield = upper.includes("RECHARGE_PLAYER_SHIELD");

        return {
            targetType,
            moveSpeed,
            fireLaser,
            autoTransfer,
            rechargeShield
        };
    },

    insertLine(lineStr) {
        const ta = document.getElementById("sucode-textarea");
        if (!ta) return;
        const loopEndIdx = ta.value.lastIndexOf("LOOP_END()");
        if (loopEndIdx !== -1) {
            ta.value = ta.value.slice(0, loopEndIdx) + "  " + lineStr + "\n" + ta.value.slice(loopEndIdx);
        } else {
            ta.value += "\n  " + lineStr;
        }
    },

    loadPreset(presetName) {
        const ta = document.getElementById("sucode-textarea");
        if (!ta) return;
        if (presetName === "miner") {
            ta.value = `// Preset: Penambang Otomatis Serbaguna
LOOP_START()
  SCAN_TARGET("ALL")
  MOVE_TO_TARGET(1.5)
  FIRE_MINING_LASER()
  IF_FULL_TRANSFER_TO_PLAYER()
LOOP_END()`;
        } else if (presetName === "shard") {
            ta.value = `// Preset: Pemburu Kristal Langka Sucode Shard
LOOP_START()
  SCAN_TARGET("SUCODE")
  MOVE_TO_TARGET(2.2)
  FIRE_MINING_LASER()
  IF_FULL_TRANSFER_TO_PLAYER()
LOOP_END()`;
        } else if (presetName === "guardian") {
            ta.value = `// Preset: Drone Pendamping & Pengisi Perisai
LOOP_START()
  RECHARGE_PLAYER_SHIELD()
  SCAN_TARGET("COBALT")
  MOVE_TO_TARGET(1.4)
  FIRE_MINING_LASER()
  IF_FULL_TRANSFER_TO_PLAYER()
LOOP_END()`;
        }
        this.setConsole("[SUCODE OS] Preset berhasil dimuat. Klik Rakit atau Update Drone.");
    },

    setConsole(msg) {
        const el = document.getElementById("sucode-console");
        if (el) el.textContent = msg;
    },

    updateActiveDrones() {
        const code = document.getElementById("sucode-textarea").value;
        const parsed = this.parseProgram(code);
        for (const d of this.drones) {
            d.config = parsed;
            d.targetNode = null;
        }
        window.SpaceAudio.playChime("deploy");
        this.setConsole(`[SUCODE KOMPILASI SUKSES] ${this.drones.length} unit Drone diperbarui (Target: ${parsed.targetType}, Speed: ${parsed.moveSpeed}x).`);
        window.Game.logActivity(`💻 Kode Sucode diperbarui pada ${this.drones.length} Drone.`);
    },

    deployNewDrone() {
        const game = window.Game;
        if (!game) return;

        if (game.inventory.FERRITE < 20 || game.inventory.SUCODE < 5) {
            this.setConsole("[ERROR] Sumber daya kurang! Butuh 20 Ferrite & 5 Sucode Shard.");
            return;
        }

        game.inventory.FERRITE -= 20;
        game.inventory.SUCODE -= 5;

        const code = document.getElementById("sucode-textarea").value;
        const parsed = this.parseProgram(code);
        const spawnPos = game.getActivePosition().clone().add(new THREE.Vector3(0, 4, 0));

        const drone = new SucodeDrone(this.drones.length + 1, game, parsed, spawnPos);
        this.drones.push(drone);

        window.SpaceAudio.playChime("deploy");
        game.updateHUD();
        this.setConsole(`[SUKSES] Drone #${drone.id} berhasil dirakit & diluncurkan dengan instruksi Sucode!`);
        game.logActivity(`🤖 Drone Sucode #${drone.id} aktif (Target: ${parsed.targetType})`);
    },

    updateAll(dt, time) {
        for (const d of this.drones) {
            d.update(dt, time);
        }
    }
};

window.SucodeSystem = SucodeSystem;
