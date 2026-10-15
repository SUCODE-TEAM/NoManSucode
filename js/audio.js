/**
 * NoManSucode - Procedural Web Audio Synthesizer
 * Menghasilkan efek suara sci-fi (laser, mesin pesawat, radar scan, sucode beep) secara real-time tanpa file MP3 eksternal.
 */
class SpaceAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.engineOsc = null;
        this.engineGain = null;
    }

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();

        // Continuous subtle engine hum
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = "sawtooth";
        this.engineOsc.frequency.value = 55;
        this.engineGain.gain.value = 0.0;

        // Lowpass filter agar suara mesin lembut
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 180;

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
    }

    updateEngineSound(speedRatio, isShipMode) {
        if (!this.ctx || !this.engineGain) return;
        if (this.ctx.state === "suspended") this.ctx.resume();

        if (!isShipMode) {
            this.engineGain.gain.setTargetAtTime(0.005, this.ctx.currentTime, 0.1);
            return;
        }
        const targetFreq = 48 + Math.min(1.5, speedRatio) * 95;
        const targetGain = 0.02 + Math.min(1.0, speedRatio) * 0.05;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
        this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    }

    playLaser(freqStart = 520, freqEnd = 160, duration = 0.12) {
        if (!this.ctx || !this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(freqStart, now);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
    }

    playScanPulse() {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.45);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    playChime(type = "pickup") {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";

        if (type === "pickup") {
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880, now + 0.07); // A5
        } else if (type === "deploy") {
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(659.25, now + 0.08);
            osc.frequency.setValueAtTime(880, now + 0.16);
        } else {
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.setValueAtTime(480, now + 0.1);
        }

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

window.SpaceAudio = new SpaceAudio();
