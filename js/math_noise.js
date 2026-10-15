/**
 * NoManSucode - Procedural Noise & Seeded Math Library
 * Menghasilkan permukaan planet 3D bulat utuh secara deterministik dari Seed teks/angka.
 */
class SeededNoise {
    constructor(seedStr = "SUCODE-2026") {
        this.setSeed(seedStr);
    }

    setSeed(seedStr) {
        this.seedStr = String(seedStr || "SUCODE-2026");
        let h = 2166136261 >>> 0;
        for (let i = 0; i < this.seedStr.length; i++) {
            h ^= this.seedStr.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        this.seed = h >>> 0;

        // Permutation table untuk 3D Noise cepat
        this.perm = new Uint8Array(512);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;

        let s = this.seed;
        for (let i = 255; i > 0; i--) {
            s = (Math.imul(1664525, s) + 1013904223) >>> 0;
            const j = s % (i + 1);
            const tmp = p[i];
            p[i] = p[j];
            p[j] = tmp;
        }
        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
        }
    }

    // Seeded pseudo-random [0, 1)
    random() {
        this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
        return (this.seed >>> 0) / 4294967296;
    }

    randomRange(min, max) {
        return min + this.random() * (max - min);
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    // 3D Perlin Noise [-1, 1]
    noise3D(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const p = this.perm;
        const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
        const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

        return this.lerp(w,
            this.lerp(v,
                this.lerp(u, this.grad(p[AA], x, y, z), this.grad(p[BA], x - 1, y, z)),
                this.lerp(u, this.grad(p[AB], x, y - 1, z), this.grad(p[BB], x - 1, y - 1, z))
            ),
            this.lerp(v,
                this.lerp(u, this.grad(p[AA + 1], x, y, z - 1), this.grad(p[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(p[AB + 1], x, y - 1, z - 1), this.grad(p[BB + 1], x - 1, y - 1, z - 1))
            )
        );
    }

    // Fractal Brownian Motion (fBm) 3D untuk relief gunung & kawah planet
    fbm3D(x, y, z, octaves = 4, lacunarity = 2.1, gain = 0.5) {
        let total = 0;
        let frequency = 1.0;
        let amplitude = 1.0;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= gain;
            frequency *= lacunarity;
        }
        return total / maxValue;
    }
}

window.SeededNoise = SeededNoise;
