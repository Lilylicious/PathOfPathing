type ProfileView = 'wide' | 'close';
type SceneInfo = Record<string, string | number | boolean>;
type GL = WebGLRenderingContext | WebGL2RenderingContext;

interface ProfileCamera {
    move(x: number, y: number): void;
    restore(): void;
}

interface ProfileScene {
    describe(): SceneInfo;
    beginPan(view: ProfileView): ProfileCamera;
}

interface ProfileSample {
    view: ProfileView;
    camera: ProfileCamera;
    scene: SceneInfo;
    start: number;
    measuring: boolean;
    frame: number[];
    cull: number[];
    render: number[];
    draws: number[];
    gpu: number[];
    queries: WebGLQuery[];
}

interface TimerExtension {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
}

const warmupMs = 500;
const sampleMs = 2000;
const drainMs = 250;
const drawMethods = ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'] as const;

function summarize(values: number[]) {
    if (values.length === 0) {
        return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const round = (value: number) => Math.round(value * 100) / 100;
    const percentile = (rank: number) => sorted[Math.ceil(rank * sorted.length) - 1];
    return {
        samples: sorted.length,
        p50: round(percentile(0.5)),
        p95: round(percentile(0.95)),
        max: round(sorted[sorted.length - 1]),
    };
}

function reportSample(sample: ProfileSample) {
    return {
        ...sample.scene,
        frameIntervalMs: summarize(sample.frame),
        cullCpuMs: summarize(sample.cull),
        renderCpuMs: summarize(sample.render),
        renderGpuMs: summarize(sample.gpu),
        drawCalls: summarize(sample.draws),
    };
}

export class RenderProfiler {
    private readonly button = document.createElement('button');
    private readonly report = document.createElement('pre');
    private readonly webgl2: WebGL2RenderingContext | undefined;
    private readonly timer: TimerExtension | null;
    private sample?: ProfileSample;
    private wide?: ReturnType<typeof reportSample>;
    private drawCount = 0;
    private restoreDrawMethods?: () => void;

    constructor(private readonly gl: GL, private readonly scene: ProfileScene) {
        this.webgl2 = 'beginQuery' in gl ? gl : undefined;
        this.timer = this.webgl2?.getExtension('EXT_disjoint_timer_query_webgl2') ?? null;

        const panel = document.createElement('aside');
        Object.assign(panel.style, {
            position: 'fixed', top: '12px', right: '12px', zIndex: '1000', padding: '8px',
            maxWidth: 'calc(100vw - 40px)', color: '#fff', background: '#191919',
        });
        this.button.id = 'render-profile-run';
        this.button.type = 'button';
        this.button.textContent = 'Run render benchmark';
        this.button.addEventListener('click', this.run);
        this.report.id = 'render-profile-report';
        this.report.setAttribute('aria-live', 'polite');
        Object.assign(this.report.style, { margin: '8px 0 0', maxHeight: '55vh', overflow: 'auto', fontSize: '12px' });
        panel.append(this.button, this.report);
        document.body.appendChild(panel);
        document.addEventListener('visibilitychange', () => {
            if (this.sample && document.hidden) {
                this.finish('Benchmark stopped because the tab was hidden.', 'failed');
            }
        });
    }

    get active(): boolean {
        return this.sample !== undefined;
    }

    frame(delta: number): void {
        const sample = this.sample;
        if (!sample) {
            return;
        }

        try {
            this.advanceSample(sample, delta);
        } catch (error) {
            this.fail(error);
        }
    }

    private advanceSample(sample: ProfileSample, delta: number): void {
        const elapsed = performance.now() - sample.start;
        if (sample.measuring && delta > 0) {
            // This interval reflects work done after the preceding animation-frame callback.
            sample.frame.push(delta);
        }

        sample.measuring = elapsed >= warmupMs && elapsed < warmupMs + sampleMs;
        if (elapsed < warmupMs + sampleMs) {
            const angle = elapsed * Math.PI / 1000;
            sample.camera.move(Math.sin(angle) * 100, Math.sin(angle * 2) * 50);
            return;
        }

        this.collectGpu(sample);
        if (sample.queries.length > 0 && elapsed < warmupMs + sampleMs + drainMs) {
            return;
        }

        const result = reportSample(sample);
        this.restoreCamera();
        if (sample.view === 'wide') {
            this.wide = result;
            this.startSample('close');
        } else {
            const debug = this.gl.getExtension('WEBGL_debug_renderer_info');
            const output = {
                devicePixelRatio: window.devicePixelRatio,
                framebuffer: `${this.gl.drawingBufferWidth} × ${this.gl.drawingBufferHeight}`,
                graphicsRenderer: this.gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? this.gl.RENDERER),
                gpuTimingAvailable: this.timer !== null,
                wide: this.wide,
                close: result,
            };
            console.info('Path of Pathing render benchmark', output);
            this.finish(JSON.stringify(output, null, 2), 'complete');
        }
    }

    draw(cull: () => void, render: () => void): void {
        const sample = this.sample;
        try {
            if (sample?.measuring) {
                this.measureDraw(sample, cull, render);
            } else {
                cull();
                render();
            }
        } catch (error) {
            if (sample) {
                this.fail(error);
            }
            throw error;
        }
    }

    private measureDraw(sample: ProfileSample, cull: () => void, render: () => void): void {
        const start = performance.now();
        cull();
        sample.cull.push(performance.now() - start);

        // Sample GPU time periodically without synchronously waiting for GPU work.
        const { webgl2, timer } = this;
        const query = webgl2 && timer && sample.render.length % 6 === 0 ? webgl2.createQuery() : null;
        if (webgl2 && timer && query) {
            sample.queries.push(query);
            webgl2.beginQuery(timer.TIME_ELAPSED_EXT, query);
        }
        this.drawCount = 0;
        const renderStart = performance.now();
        try {
            render();
            sample.render.push(performance.now() - renderStart);
            sample.draws.push(this.drawCount);
        } finally {
            if (webgl2 && timer && query) {
                webgl2.endQuery(timer.TIME_ELAPSED_EXT);
            }
        }
    }

    private run = (): void => {
        if (this.button.disabled) {
            return;
        }
        if (document.hidden) {
            this.finish('Benchmark needs a visible tab.', 'failed');
            return;
        }

        this.button.disabled = true;
        this.report.dataset.state = 'running';
        try {
            this.countDrawCalls();
            this.startSample('wide');
        } catch (error) {
            this.fail(error);
        }
    };

    private startSample(view: ProfileView): void {
        this.report.textContent = `Measuring the ${view} view`;
        const camera = this.scene.beginPan(view);
        this.sample = {
            view, camera, scene: {}, start: performance.now(), measuring: false,
            frame: [], cull: [], render: [], draws: [], gpu: [], queries: [],
        };
        this.sample.scene = this.scene.describe();
    }

    private fail(error: unknown): void {
        console.error('Render benchmark failed', error);
        const message = error instanceof Error ? error.message : String(error);
        this.finish(`Benchmark failed. ${message}`, 'failed');
    }

    private finish(text: string, state: 'complete' | 'failed'): void {
        const restoreDrawMethods = this.restoreDrawMethods;
        this.restoreDrawMethods = undefined;
        try {
            try {
                this.restoreCamera();
            } finally {
                restoreDrawMethods?.();
            }
        } catch (error) {
            console.error('Render benchmark cleanup failed', error);
            text = 'Benchmark cleanup failed. Reload the page to reset the view.';
            state = 'failed';
        }

        this.button.disabled = false;
        this.report.dataset.state = state;
        this.report.textContent = text;
    }

    private restoreCamera(): void {
        const sample = this.sample;
        if (sample) {
            this.sample = undefined;
            try {
                sample.camera.restore();
            } finally {
                for (const query of sample.queries) {
                    this.webgl2?.deleteQuery(query);
                }
            }
        }
    }

    private countDrawCalls(): void {
        type DrawMethod = typeof drawMethods[number];
        const context: Partial<Record<DrawMethod, (...args: number[]) => void>> = this.gl;
        const original = new Map<DrawMethod, PropertyDescriptor | undefined>();
        this.restoreDrawMethods = () => {
            for (const [method, descriptor] of original) {
                if (descriptor) {
                    Object.defineProperty(context, method, descriptor);
                } else {
                    delete context[method];
                }
            }
        };
        for (const method of drawMethods) {
            const draw = context[method];
            if (draw) {
                const descriptor = Object.getOwnPropertyDescriptor(context, method);
                context[method] = (...args) => {
                    this.drawCount++;
                    draw.apply(this.gl, args);
                };
                original.set(method, descriptor);
            }
        }
    }

    private collectGpu(sample: ProfileSample): void {
        const { webgl2, timer } = this;
        if (!webgl2 || !timer || sample.queries.length === 0) {
            return;
        }
        if (webgl2.getParameter(timer.GPU_DISJOINT_EXT)) {
            sample.gpu.length = 0;
            for (const query of sample.queries.splice(0)) {
                webgl2.deleteQuery(query);
            }
            return;
        }
        sample.queries = sample.queries.filter(query => {
            if (!webgl2.getQueryParameter(query, webgl2.QUERY_RESULT_AVAILABLE)) {
                return true;
            }
            sample.gpu.push(webgl2.getQueryParameter(query, webgl2.QUERY_RESULT) / 1_000_000);
            webgl2.deleteQuery(query);
            return false;
        });
    }
}
