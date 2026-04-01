/**
 * extract-echarts-theme.mjs
 *
 * Reads Atlas UI CSS/SCSS color variables from a Mendix project and generates
 * an ECharts theme JSON file ready to paste into the ECharts Theme Loader widget.
 *
 * Usage:
 *   node tools/extract-echarts-theme.mjs [mendix-project-root] [theme-name] [output-file]
 *
 * Defaults:
 *   mendix-project-root  →  ../../   (two levels up from this file, i.e. the Mendix project)
 *   theme-name           →  "atlas"
 *   output-file          →  tools/atlas-echarts-theme.json
 *
 * Examples:
 *   node tools/extract-echarts-theme.mjs
 *   node tools/extract-echarts-theme.mjs D:/MxProjects/MyApp myTheme output/my-theme.json
 */

import fs   from 'fs';
import path from 'path';

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

const projectRoot = args[0]
    ? path.resolve(args[0])
    : path.resolve(scriptDir, '../../../');

const themeName  = args[1] ?? 'atlas';
const outputFile = args[2]
    ? path.resolve(args[2])
    : path.join(scriptDir, `${themeName}-echarts-theme.json`);

// ─── Source file candidates ───────────────────────────────────────────────────
// BASE: Atlas core defaults (first found is used)
const BASE_CANDIDATES = [
    'themesource/atlas_core/web/themes/_theme-default.scss',
    'themesource/atlas_core/web/_theme-default.scss',
    'theme/web/main.scss',
];

// OVERRIDES: project-level customizations layered on top of the base (all found are merged)
const OVERRIDE_CANDIDATES = [
    'theme/web/custom-variables.scss',
];

// ─── Color math ───────────────────────────────────────────────────────────────

function hexToRgb(hex) {
    hex = hex.trim().replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/**
 * Simulate Atlas UI color-mix shade generation.
 * positive pct → mix with white (lighten)
 * negative pct → mix with black (darken)
 */
function mixColor(hexColor, pct) {
    const [r, g, b] = hexToRgb(hexColor);
    const f = Math.abs(pct) / 100;
    if (pct > 0) {
        // mix with white
        return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
    } else if (pct < 0) {
        // mix with black
        return rgbToHex(r * (1 - f), g * (1 - f), b * (1 - f));
    }
    return hexColor;
}

/** Generate the 10 shade variants for a base color (matching Atlas UI's $lightness-steps). */
function buildShades(hex) {
    return {
        50:  mixColor(hex,  90),
        100: mixColor(hex,  80),
        200: mixColor(hex,  60),
        300: mixColor(hex,  40),
        400: mixColor(hex,  20),
        500: hex,
        600: mixColor(hex, -20),
        700: mixColor(hex, -40),
        800: mixColor(hex, -50),
        900: mixColor(hex, -60),
    };
}

// ─── SCSS/CSS parser ──────────────────────────────────────────────────────────

/**
 * Extract all `--name: value` pairs from a CSS/SCSS string.
 * Handles multi-line values and both CSS and SCSS comment styles.
 */
function parseCssVariables(src) {
    // Strip comments
    src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    const vars = {};
    const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}{]+)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        vars['--' + m[1]] = m[2].trim();
    }
    return vars;
}

/** Resolve a value that may be `var(--xxx)` or a literal hex/color. */
function resolveVar(value, vars, depth = 0) {
    if (depth > 10) return value; // cycle guard
    value = value.trim();

    // Direct hex color
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;

    // var(--name) with optional fallback: var(--name, fallback)
    const varMatch = value.match(/^var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*(.+))?\)$/);
    if (varMatch) {
        const name = varMatch[1];
        const fallback = varMatch[2];
        if (vars[name]) return resolveVar(vars[name], vars, depth + 1);
        if (fallback)   return resolveVar(fallback, vars, depth + 1);
        return null;
    }

    return null; // cannot resolve (gradient, color-mix, etc.)
}

// ─── Find and parse source files ─────────────────────────────────────────────

function loadVariables(root) {
    // 1. Load base Atlas core file
    let baseFile = null;
    for (const rel of BASE_CANDIDATES) {
        const full = path.join(root, rel);
        if (fs.existsSync(full)) { baseFile = full; break; }
    }
    if (!baseFile) {
        console.error('ERROR: Could not find Atlas UI base theme file in:', root);
        console.error('Tried:\n' + BASE_CANDIDATES.map(c => '  ' + path.join(root, c)).join('\n'));
        process.exit(1);
    }
    console.log('Reading base:     ', baseFile);
    let vars = parseCssVariables(fs.readFileSync(baseFile, 'utf8'));

    // 2. Layer project-level overrides on top
    for (const rel of OVERRIDE_CANDIDATES) {
        const full = path.join(root, rel);
        if (fs.existsSync(full)) {
            console.log('Reading overrides:', full);
            const overrides = parseCssVariables(fs.readFileSync(full, 'utf8'));
            vars = { ...vars, ...overrides };
        }
    }

    return vars;
}

// ─── Build the ECharts theme object ──────────────────────────────────────────

function buildTheme(vars) {
    // Resolve and validate the 5 base colors we need
    const base = {
        primary: resolveVar(vars['--brand-primary'] ?? '', vars),
        success: resolveVar(vars['--brand-success'] ?? '', vars),
        warning: resolveVar(vars['--brand-warning'] ?? '', vars),
        danger:  resolveVar(vars['--brand-danger']  ?? '', vars),
        gray:    resolveVar(vars['--gray']           ?? '', vars),
        white:   resolveVar(vars['--color-base']     ?? '#ffffff', vars) ?? '#ffffff',
    };

    const missing = Object.entries(base).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
        console.warn('WARNING: Could not resolve base colors:', missing.join(', '));
        console.warn('         Using fallback values.');
    }

    // Apply fallbacks
    base.primary = base.primary ?? '#264ae5';
    base.success = base.success ?? '#16aa16';
    base.warning = base.warning ?? '#cd8501';
    base.danger  = base.danger  ?? '#ea3337';
    base.gray    = base.gray    ?? '#b8babf';
    base.white   = base.white   ?? '#ffffff';

    // Generate shade families
    const p = buildShades(base.primary);
    const s = buildShades(base.success);
    const w = buildShades(base.warning);
    const d = buildShades(base.danger);
    const g = buildShades(base.gray);

    // Derived semantics
    const textColor       = g[900];          // very dark gray — main text
    const subtleText      = g[700];          // lighter gray — axis labels
    const borderColor     = g[300];          // light gray — grid lines, borders
    const gridLineColor   = g[100];          // very light — split lines inside chart
    const tooltipBg       = base.white;
    const titleColor      = p[800];          // dark primary — chart title

    // Chart color palette: lead with the brand colors, then their variants
    const palette = [
        base.primary,
        base.success,
        base.warning,
        base.danger,
        p[400],   // lighter primary
        s[400],   // lighter success
        w[400],   // lighter warning
        d[400],   // lighter danger
        p[700],   // darker primary
        s[700],   // darker success
    ];

    const theme = {
        color: palette,
        backgroundColor: 'transparent',
        textStyle: {
            color: textColor,
            fontFamily: 'Poppins, sans-serif',
        },
        title: {
            textStyle: { color: titleColor },
            subtextStyle: { color: subtleText },
        },
        legend: {
            textStyle: { color: textColor },
        },
        tooltip: {
            backgroundColor: tooltipBg,
            borderColor: borderColor,
            textStyle: { color: textColor },
        },
        grid: {
            borderColor: borderColor,
        },
        categoryAxis: {
            axisLine:  { lineStyle: { color: borderColor } },
            axisTick:  { lineStyle: { color: borderColor } },
            axisLabel: { color: subtleText },
            splitLine: { lineStyle: { color: gridLineColor } },
        },
        valueAxis: {
            axisLine:  { lineStyle: { color: borderColor } },
            axisTick:  { lineStyle: { color: borderColor } },
            axisLabel: { color: subtleText },
            splitLine: { lineStyle: { color: gridLineColor } },
        },
        timeAxis: {
            axisLine:  { lineStyle: { color: borderColor } },
            axisTick:  { lineStyle: { color: borderColor } },
            axisLabel: { color: subtleText },
            splitLine: { lineStyle: { color: gridLineColor } },
        },
        logAxis: {
            axisLine:  { lineStyle: { color: borderColor } },
            axisTick:  { lineStyle: { color: borderColor } },
            axisLabel: { color: subtleText },
            splitLine: { lineStyle: { color: gridLineColor } },
        },
        line: {
            itemStyle: { borderWidth: 2 },
            lineStyle: { width: 2 },
            symbolSize: 6,
            symbol: 'circle',
            smooth: false,
        },
        bar: {
            itemStyle: { barBorderWidth: 0 },
        },
        pie: {
            itemStyle: { borderWidth: 0 },
        },
        gauge: {
            itemStyle: { borderWidth: 0 },
        },
    };

    return theme;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function printSummary(theme) {
    console.log('\nColor palette:');
    theme.color.forEach((c, i) => console.log(`  [${i}] ${c}`));
    console.log('\nText:', theme.textStyle.color);
    console.log('Border/axis:', theme.categoryAxis.axisLine.lineStyle.color);
    console.log('Split lines:', theme.categoryAxis.splitLine.lineStyle.color);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('ECharts Theme Extractor');
console.log('Project root:', projectRoot);
console.log('Theme name:  ', themeName);
console.log('Output file: ', outputFile);
console.log('');

const vars  = loadVariables(projectRoot);
const theme = buildTheme(vars);
const json  = JSON.stringify(theme, null, 2);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, json, 'utf8');

printSummary(theme);
console.log('\nWritten to:', outputFile);
console.log('\nDone! Paste the JSON content into the ECharts Theme Loader widget,');
console.log(`and set the Theme name to "${themeName}" on both the loader and your chart widgets.`);
